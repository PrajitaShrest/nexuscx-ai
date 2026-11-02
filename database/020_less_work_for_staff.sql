-- =====================================================================
-- NexusCX AI - Migration 020: fewer cases for people, faster when they come
-- Run AFTER 019_duty_of_care.sql, once, in the Supabase SQL Editor.
--
-- Hard stops still ALWAYS go to a person. For everything else the AI now
-- tries harder first, and helps staff when a person is needed:
--
-- 1. Ask before escalating: when the AI is unsure (low confidence or no
--    exact article) it offers up to 3 likely topics as buttons instead of
--    passing the case to a person. "None of these" still reaches a person.
-- 2. "Did this help?": a thumbs up closes the case; a thumbs down passes it
--    to the right team. Articles that did not help are listed for staff.
-- 3. AI-drafted replies: for a case with a person, the AI writes a summary
--    and a suggested reply from approved articles. Staff check, edit, send.
-- =====================================================================
BEGIN;

ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS ai_helpful boolean;

-- ---------- shared: the words that matter in a question ----------
CREATE OR REPLACE FUNCTION private.topic_query(p_text text) RETURNS tsquery
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT websearch_to_tsquery('english', coalesce(nullif(array_to_string(ARRAY(
    SELECT DISTINCT w FROM regexp_split_to_table(lower(coalesce(p_text, '')), '[^a-z0-9]+') w
    WHERE length(w) >= 2 AND w NOT IN ('student','students','university','uni','northbridge','campus','semester',
      'please','thanks','thank','time','day','week','weekend','weekends','much','many','problem','issue','help','question')), ' or '), ''), 'zzzznothing'))
$$;

-- Up to 3 approved articles that might be what the person means (for the buttons)
CREATE OR REPLACE FUNCTION private.suggest_articles(p_text text, p_industry text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('title', title, 'category', category) ORDER BY r DESC), '[]')
  FROM (SELECT d.title, d.category, ts_rank(d.search, q) AS r
        FROM public.knowledge_documents d, private.topic_query(p_text) q
        WHERE d.status = 'approved' AND d.industry = p_industry AND d.search @@ q
          AND to_tsvector('english', d.title || ' ' || d.keywords) @@ q   -- a real topic match, not just a word in the text
        ORDER BY r DESC LIMIT 3) s
$$;

-- ---------- 1. Ask before escalating ----------
DROP FUNCTION IF EXISTS public.submit_enquiry(text);
CREATE OR REPLACE FUNCTION public.submit_enquiry(p_message text, p_clarified boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_customer_id uuid := private.my_customer_id();
  v_text        text := trim(COALESCE(p_message, ''));
  v_ind         text := public.current_industry();
  c             jsonb;
  v_esc         jsonb;
  v_opts        jsonb;
BEGIN
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Only signed-in customers can submit an enquiry' USING ERRCODE = '42501';
  END IF;
  IF char_length(v_text) < 5 THEN
    RAISE EXCEPTION 'Please describe your issue in at least 5 characters' USING ERRCODE = '22023';
  ELSIF char_length(v_text) > 2000 THEN
    RAISE EXCEPTION 'Please keep your message under 2000 characters' USING ERRCODE = '22023';
  END IF;

  IF NOT COALESCE(p_clarified, false) THEN
    c := private.classify_enquiry(v_text, v_ind);
    v_esc := private.pick_escalation(c);
    -- Only when the AI is merely UNSURE. Never for hard stops, sensitive or angry
    -- messages, other languages, or when the person asked for a human.
    IF v_esc->>'name' IN ('Low Confidence', 'Agent Cannot Answer')
       AND c->>'flag' IS NULL AND NOT (c->>'sensitive')::boolean AND NOT (c->>'injection')::boolean
       AND NOT (c->>'asks_human')::boolean AND c->>'language' = 'en'
       AND c->>'sentiment' <> 'angry' AND c->>'urgency' <> 'critical' THEN
      v_opts := private.suggest_articles(v_text, v_ind);
      IF jsonb_array_length(v_opts) > 0 THEN
        INSERT INTO public.audit_logs (actor, actor_type, action, entity_type, result, risk_level, details)
        VALUES ('Orchestrator', 'ai_agent', 'asked_to_clarify', 'cases', 'success', 'low',
                jsonb_build_object('question', left(v_text, 200), 'options', v_opts, 'industry', v_ind));
        RETURN jsonb_build_object('status', 'clarify', 'reply',
          'I want to get this right. Is your question about one of these?', 'options', v_opts,
          'intent', c->>'intent', 'language', c->>'language');
      END IF;
    END IF;
  END IF;
  RETURN private.handle_enquiry(v_customer_id, private.my_user_id(), v_text);
END $$;
REVOKE EXECUTE ON FUNCTION public.submit_enquiry(text, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.submit_enquiry(text, boolean) TO authenticated;

-- ---------- 2. "Did this help?" ----------
CREATE OR REPLACE FUNCTION public.answer_feedback(p_case uuid, p_helpful boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_case  public.cases;
  v_conv  uuid;
  v_dept  text;
  v_rule  uuid;
  v_reply text;
BEGIN
  SELECT * INTO v_case FROM public.cases WHERE case_id = p_case FOR UPDATE;
  IF NOT FOUND OR v_case.customer_id IS DISTINCT FROM private.my_customer_id() THEN
    RAISE EXCEPTION 'That request was not found.' USING ERRCODE = '22023';
  END IF;
  IF v_case.ai_helpful IS NOT NULL OR v_case.status <> 'ai_handling' THEN
    RETURN jsonb_build_object('status', v_case.status, 'already', true);
  END IF;
  SELECT conversation_id INTO v_conv FROM public.conversations WHERE case_id = p_case ORDER BY started_at LIMIT 1;

  IF p_helpful THEN
    UPDATE public.cases SET ai_helpful = true, status = 'resolved' WHERE case_id = p_case;
    INSERT INTO public.audit_logs (actor, actor_type, action, entity_type, entity_id, case_id, result, risk_level)
    VALUES ('Customer', 'human', 'ai_answer_helpful', 'cases', p_case, p_case, 'success', 'low');
    RETURN jsonb_build_object('status', 'resolved');
  END IF;

  -- Not helpful: pass it to the right team
  v_dept := COALESCE((SELECT a.department FROM public.ai_agents a WHERE a.agent_id = v_case.assigned_agent_id), 'support');
  SELECT rule_id INTO v_rule FROM public.escalation_rules WHERE condition_type = 'customer_requests_human';
  UPDATE public.cases SET ai_helpful = false, status = 'escalated', assigned_agent_id = NULL WHERE case_id = p_case;
  INSERT INTO public.escalations (case_id, reason, escalated_from, escalated_to, rule_id)
  VALUES (p_case, 'Answer did not help', 'Customer feedback', 'human_support_queue', v_rule);
  v_reply := 'Sorry that did not help. I have passed your question to the ' || v_dept || ' team, and a person will reply here soon.';
  INSERT INTO public.messages (conversation_id, sender_type, sender_id, content, message_type)
  VALUES (v_conv, 'system', NULL, v_reply, 'escalation_notice');
  INSERT INTO public.notifications (user_id, type, title, case_id)
  SELECT u.user_id, 'new_escalation', v_case.case_number || ': Answer did not help', p_case
  FROM public.users u WHERE u.role IN ('support_agent','team_leader') AND u.status = 'active';
  INSERT INTO public.audit_logs (actor, actor_type, action, entity_type, entity_id, case_id, result, risk_level, details)
  VALUES ('Customer', 'human', 'ai_answer_not_helpful', 'cases', p_case, p_case, 'success', 'low',
          jsonb_build_object('article', (SELECT d.title FROM public.knowledge_retrievals k JOIN public.knowledge_documents d USING (document_id)
                                         WHERE k.case_id = p_case LIMIT 1)));
  RETURN jsonb_build_object('status', 'escalated', 'reply', v_reply);
END $$;
REVOKE ALL ON FUNCTION public.answer_feedback(uuid, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.answer_feedback(uuid, boolean) TO authenticated;

-- Articles people said did not help (for the Knowledge gaps page)
CREATE OR REPLACE FUNCTION public.unhelpful_articles(p_days int DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_ind  text := public.current_industry();
  v_days int  := CASE WHEN p_days IN (7, 30, 90) THEN p_days ELSE 30 END;
BEGIN
  IF NOT private.has_permission('manage_knowledge') THEN
    RAISE EXCEPTION 'You do not have permission to view this.' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((SELECT jsonb_agg(x ORDER BY x.not_helpful DESC, x.title) FROM (
    SELECT d.document_id, d.title,
           count(*) FILTER (WHERE c.ai_helpful = false) AS not_helpful,
           count(*) FILTER (WHERE c.ai_helpful = true)  AS helpful,
           (SELECT array_agg(s ORDER BY s) FROM (SELECT DISTINCT c2.subject AS s FROM public.knowledge_retrievals k2
              JOIN public.cases c2 ON c2.case_id = k2.case_id WHERE k2.document_id = d.document_id AND c2.ai_helpful = false
              AND c2.created_at >= now() - make_interval(days => v_days) LIMIT 3) t) AS questions
    FROM public.knowledge_retrievals k
    JOIN public.cases c ON c.case_id = k.case_id
    JOIN public.knowledge_documents d ON d.document_id = k.document_id
    WHERE c.industry = v_ind AND c.created_at >= now() - make_interval(days => v_days) AND c.ai_helpful IS NOT NULL
    GROUP BY d.document_id, d.title
    HAVING count(*) FILTER (WHERE c.ai_helpful = false) > 0) x), '[]');
END $$;
REVOKE ALL ON FUNCTION public.unhelpful_articles(int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.unhelpful_articles(int) TO authenticated;

-- ---------- 3. AI-drafted reply for staff ----------
CREATE OR REPLACE FUNCTION public.suggest_reply(p_case uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_case   public.cases;
  v_q      text;
  c        jsonb;
  v_first  text;
  v_me     text;
  v_team   text;
  v_reason text;
  v_title  text;
  v_body   text;
  v_draft  text;
  v_topic  text;
BEGIN
  IF NOT private.has_permission('view_cases') THEN
    RAISE EXCEPTION 'You do not have permission to view cases.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_case FROM public.cases WHERE case_id = p_case;
  IF NOT FOUND THEN RETURN NULL; END IF;
  v_q := private.first_question(p_case);
  c := private.classify_enquiry(v_q, v_case.industry);
  v_first := split_part((SELECT u.name FROM public.customers k JOIN public.users u ON u.user_id = k.user_id
                         WHERE k.customer_id = v_case.customer_id), ' ', 1);
  v_me := split_part((SELECT name FROM public.users WHERE user_id = private.my_user_id()), ' ', 1);
  v_team := COALESCE(c->>'department', CASE WHEN v_case.industry = 'university' THEN 'Student Services' ELSE 'Support' END);
  v_reason := (SELECT reason FROM public.escalations WHERE case_id = p_case ORDER BY created_at DESC LIMIT 1);
  v_topic := CASE v_case.intent WHEN 'fees' THEN 'fees and finance' WHEN 'it_support' THEN 'IT support'
               WHEN 'academic' THEN 'study, exams or results' WHEN 'student_services' THEN 'student services'
               WHEN 'admissions' THEN 'admissions' WHEN 'order_status' THEN 'an order' WHEN 'return_request' THEN 'a return'
               WHEN 'billing_question' THEN 'billing' WHEN 'refund_request' THEN 'a refund' WHEN 'technical_issue' THEN 'a technical problem'
               WHEN 'account' THEN 'their account' ELSE 'something general' END;

  -- the best approved article: exact match first, otherwise the closest one
  v_title := c->>'doc_title'; v_body := c->>'doc_content';
  IF v_body IS NULL THEN
    SELECT d.title, d.content INTO v_title, v_body FROM public.knowledge_documents d, private.topic_query(v_q) q
    WHERE d.status = 'approved' AND d.industry = v_case.industry AND d.search @@ q
    ORDER BY ts_rank(d.search, q) DESC LIMIT 1;
  END IF;

  v_draft := 'Hi ' || COALESCE(nullif(v_first, ''), 'there') || ', thank you for your message. ' ||
    CASE v_case.safety_flag
      WHEN 'wellbeing' THEN 'I''m from the Student Wellbeing team and I''m glad you reached out. I would like to call you today to talk about how you are going and what support would help. What is a good time and number to reach you? If you ever feel unsafe, please call 000 straight away, or Lifeline on 13 11 14 at any time.'
      WHEN 'visa' THEN 'I''m an International Student Adviser. I can''t give advice on your own visa in writing, but I can book you a free, confidential appointment with an adviser to go through your situation. The general rules are on homeaffairs.gov.au. Would you like me to book a time this week?'
      WHEN 'academic' THEN 'I''ve looked at your request. Special consideration, academic integrity and grade review decisions are made by Academic Services using the evidence you provide. Please upload any supporting documents (for example a medical certificate) and I will make sure your request is assessed. I will keep you updated here.'
      WHEN 'finance' THEN 'I''ve looked at your account. Refund, hardship and debt requests are reviewed by Student Finance. I will check your enrolment dates and fees and reply here with the outcome. If you are under financial pressure right now, please let me know and I can refer you to hardship support.'
      WHEN 'refund' THEN 'I''ve checked your order and I''m reviewing the refund now. I will confirm the outcome here, and any approved refund takes 3 to 5 business days to appear on your statement.'
      ELSE COALESCE(v_body, 'I''ve looked into this for you and I will reply with the details shortly.')
    END ||
    E'\n\nPlease reply here if anything is unclear.\nKind regards,\n' || COALESCE(nullif(v_me, ''), 'The team') || ', ' || v_team;

  RETURN jsonb_build_object(
    'summary', COALESCE(nullif(v_first, ''), 'The person') || ' asked about ' || v_topic ||
               CASE WHEN v_case.sentiment IN ('angry', 'negative') THEN ' and sounds ' || CASE v_case.sentiment WHEN 'angry' THEN 'upset' ELSE 'unhappy' END ELSE '' END ||
               CASE WHEN v_case.language <> 'en' THEN ' (message not in English: reply in their language if you can)' ELSE '' END || '.' ||
               CASE WHEN v_reason = 'Answer did not help' THEN ' They said the AI''s answer' || COALESCE(' ("' || v_title || '")', '') ||
                    ' did not help, so add detail rather than sending the same answer.' ELSE '' END,
    'reason', COALESCE(v_reason, 'Not passed to a person'),
    'flag', v_case.safety_flag,
    'source', CASE WHEN v_case.safety_flag IS NULL OR v_case.safety_flag IN ('security','support','account_change','injection') THEN v_title END,
    'draft', v_draft);
END $$;
REVOKE ALL ON FUNCTION public.suggest_reply(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.suggest_reply(uuid) TO authenticated;

-- Questions about a specific order never stop to ask: they always become a case
CREATE OR REPLACE FUNCTION public.ask_about_order(p_order_id uuid, p_message text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_cust uuid := private.require_customer(); v_number text; v_result jsonb;
BEGIN
  SELECT order_number INTO v_number FROM public.orders WHERE order_id = p_order_id AND customer_id = v_cust;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found' USING ERRCODE = '22023'; END IF;
  v_result := public.submit_enquiry('About my order ' || v_number || ': ' || trim(COALESCE(p_message,'')), true);
  UPDATE public.cases SET order_id = p_order_id WHERE case_id = (v_result ->> 'case_id')::uuid;
  RETURN v_result || jsonb_build_object('order_number', v_number);
END $$;

COMMIT;
