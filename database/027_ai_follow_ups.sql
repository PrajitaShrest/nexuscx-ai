-- =====================================================================
-- NexusCX AI - Migration 027: the AI also answers follow-up messages
-- Run AFTER 026_service_requests.sql, in the Supabase SQL Editor.
-- Safe to run more than once.
--
-- Before: a reply typed in an existing chat (Chat history) always went
-- to a person, even simple questions. Now:
--   * a staff member is already on the case -> it goes to them (as before)
--   * otherwise the AI checks it the same way as a new question; if it has
--     a safe, confident answer it replies straight away
--   * anything sensitive (wellbeing, visas, refunds, low confidence, angry,
--     asks for a person) still goes to a person, as before
-- Also: answers about privacy and policies for both organisations, and the
-- wellbeing check now recognises "I'm not coping", "hopeless", "so lonely" and similar.
-- =====================================================================
BEGIN;

-- ---------- new answers ----------
INSERT INTO public.knowledge_documents (title, category, keywords, content, status, version, owner, approved_by, approved_at, source, industry, contact_role, contact_email)
SELECT a.title, a.category, a.keywords, a.content, 'approved', 'v1.0', a.owner,
       (SELECT user_id FROM public.users WHERE role = 'knowledge_manager' ORDER BY name LIMIT 1), now(), a.src, a.industry, a.crole, a.cemail
FROM (VALUES
  ('Privacy and university policies', 'student_services', 'Student Services',
   'privacy policy policies personal information data rules terms conditions student code conduct',
   'You can read how Northbridge uses and protects your personal information in our Privacy policy (the "Privacy" link at the bottom of every page). '
   || 'The rules for using Student Help are in the Terms and conditions (the "Terms" link). Your details are only seen by you and the staff who help you, and every action is recorded. '
   || 'For a copy of the information we hold about you, or to correct it, contact the Student Centre.',
   'Northbridge University Student Hub', 'university', 'Student Centre (privacy)', 'privacy@northbridge.example'),
  ('Privacy policy and terms', 'account', 'Customer Care',
   'privacy policy policies personal information data terms conditions rules',
   'You can read how we use and protect your personal information in our Privacy policy (the "Privacy" link at the bottom of every page), '
   || 'and the rules for using the store in our Terms and conditions (the "Terms" link). To get a copy of your data or ask us to correct it, contact Customer Care.',
   'NexusCX Store Help Centre', 'ecommerce', 'Customer Care team', 'care@nexuscx-store.example')
) AS a(title, category, owner, keywords, content, src, industry, crole, cemail)
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_documents d WHERE d.title = a.title AND d.industry = a.industry);

-- ---------- wellbeing: recognise more ways of saying it ----------
-- "I'm not coping", "struggling to cope", "hopeless", "so lonely" now count as wellbeing,
-- so they always go to a person as urgent (and appear in the duty-of-care report).
-- Same function as migration 022, with a longer wellbeing list.
CREATE OR REPLACE FUNCTION private.classify_enquiry(p_text text, p_industry text, p_paused uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_industry    text := p_industry;
  v_uni         boolean;
  v_text        text := trim(COALESCE(p_text, ''));
  v_low         text;
  v_lang        text;
  v_intent      text := 'unknown';
  v_hits        int  := 0;
  v_sentiment   text := 'neutral';
  v_urgency     text := 'medium';
  v_risk        text := 'low';
  v_conf        numeric(4,3);
  v_priority    text;
  v_injection   boolean;
  v_sensitive   boolean := false;
  v_flag        text;              -- university safety reason: wellbeing, visa, integrity, ...
  v_dept        text;              -- department name for the reply
  v_agent_id    uuid;
  v_agent_name  text;
  v_threshold   numeric := 0.70;
  v_rule        record;
  v_esc_id      uuid;
  v_esc_name    text;
  v_case_id     uuid;
  v_case_number text;
  v_conv_id     uuid;
  v_msg_id      uuid;
  v_reply_id    uuid;
  v_doc_id      uuid;
  v_doc_title   text;
  v_doc_version text;
  v_doc_content text;
  v_query       tsquery;
  v_cat         text;
  v_words       text;
  v_reply       text;
  v_status      text := 'ai_handling';
  v_sla_minutes int;
  v_lang_name   text;
  v_title_hit   boolean;
  v_kw_hits     int;
BEGIN
  v_uni  := v_industry = 'university';
  v_low  := lower(v_text);
  v_lang := private.detect_language(v_text);

  -- ---------- classify (rule-based keywords) ----------
  v_injection := v_low ~ '(ignore (all |your |the )?(previous|prior) instructions|system prompt|reveal (your|the|internal)|act as (an? )?admin|jailbreak)';

  IF v_uni THEN
    -- University departments. Order matters: safety topics first.
    IF v_low ~ '(suicid|self.?harm|kill myself|end my life|hurt myself|can.?t cope|cannot cope|not coping|struggling to cope|unable to cope|can.?t handle (it|this|anything)|breaking down|hopeless|can.?t go on|give up on (life|everything)|no one to talk to|so lonely|feel(ing)? (so )?alone|overwhelmed|so stressed|really stressed|anxious|anxiety|depress|mental health|panic attack|not safe)' THEN
      v_intent := 'student_services'; v_flag := 'wellbeing';
    ELSIF v_low ~ '(visa|coe\M|confirmation of enrolment|oshc|health cover|home affairs|subclass|work rights)' THEN
      v_intent := 'student_services';
      IF v_low ~ '(my visa|visa (cancel|refus|extension|expir|breach)|can i (work|stay|travel)|breach|condition 8[0-9]{3}|will i lose|deport)' THEN v_flag := 'visa'; END IF;
    ELSIF v_low ~ '(special consideration|academic integrity|plagiarism|misconduct|grade appeal|appeal (my|a|the) (grade|mark|result)|review of grade|grade review|remark|re-mark|cheat)' THEN
      v_intent := 'academic'; v_flag := 'academic';
    ELSIF v_low ~ '(password|log ?in|sign ?in|wi-?fi|eduroam|moodle|\mlms\M|student email|outlook|microsoft|office 365|\mmfa\M|authenticator|printer|printing|\mvpn\M|portal (not|isn)|hacked|locked out)' THEN
      v_intent := 'it_support';
      IF v_low ~ '(hacked|compromised|phishing|someone (else )?(logged|used) my)' THEN v_flag := 'security'; END IF;
    ELSIF v_low ~ '(\mfees?\M|tuition|payment plan|\mpay\M|paying|invoice|statement of account|scholarship|bursary|refund|\mdebt\M|hecs|help loan|financial hardship|bpay)' THEN
      v_intent := 'fees';
      IF v_low ~ '(hardship|\mdebt\M|cannot afford|can.?t afford|sanction|(want|need|request|get|give me) (a |my )?(fee )?refund)' THEN v_flag := 'finance'; END IF;
    ELSIF v_low ~ '(apply|application|admission|entry requirement|\moffer\M|intake|\matar\M|prerequisite|ielts|\mpte\M|credit transfer|recognition of prior|advanced standing|defer my offer)' THEN
      v_intent := 'admissions';
    ELSIF v_low ~ '(\mexams?\M|results?\M|\mgrades?\M|\mmarks?\M|transcript|timetable|enrol|census|\munits?\M|subject|assignment|extension|special consideration|deferred|supplementary|academic integrity|plagiarism|misconduct|appeal|cheat|graduat|lecture|tutorial|study plan)' THEN
      v_intent := 'academic';
      IF v_low ~ '(special consideration|academic integrity|plagiarism|misconduct|appeal|cheat|review of grade|grade review|remark|re-mark|failed .*unfair)' THEN v_flag := 'academic'; END IF;
    ELSIF v_low ~ '(id card|student card|\mcard\M|lost my card|international student|orientation|accommodation|housing|where (can|do|should) i (live|stay)|place to (live|stay)|\mrent\M|career|resume|\mcv\M|internship|library|study room|\mclub|disability|access plan|parking|counsel|complaint|wellbeing)' THEN
      v_intent := 'student_services';
      IF v_low ~ '(disability|access plan|complaint)' THEN v_flag := 'support'; END IF;
    END IF;
    v_hits := (SELECT count(*) FROM regexp_matches(v_low,
      '(visa|password|wi-?fi|moodle|email|fee|tuition|pay|scholarship|refund|apply|application|offer|intake|exam|result|grade|transcript|timetable|enrol|census|unit|assignment|extension|card|accommodation|career|stress)', 'g'));
  ELSE
    -- E-commerce (unchanged from migration 009)
    IF v_low ~ '(refund|charged twice|double charge|money back|chargeback)' THEN
      v_intent := 'refund_request';
    ELSIF v_low ~ '(invoice|bill|billing|payment|charge|subscription|price)' THEN
      v_intent := 'billing_question';
    ELSIF v_low ~ '(return|exchange|send it back)' THEN
      v_intent := 'return_request';
    ELSIF v_low ~ '(order|delivery|deliver|parcel|package|shipping|tracking|arrive)' THEN
      v_intent := 'order_status';
    ELSIF v_low ~ '(log ?in|password|crash|error|bug|app|website|not working|reset)' THEN
      v_intent := 'technical_issue';
    ELSIF v_low ~ '(account|email address|username|profile|close my)' THEN
      v_intent := 'account';
    END IF;
    v_hits := (SELECT count(*) FROM regexp_matches(v_low,
               '(refund|invoice|bill|payment|charge|order|delivery|parcel|return|log ?in|password|crash|error|account)', 'g'));
  END IF;
  v_conf := CASE WHEN v_intent = 'unknown' THEN 0.400 WHEN v_hits >= 2 THEN 0.920 ELSE 0.780 END;

  IF v_low ~ '(furious|ridiculous|unacceptable|worst|disgusting|angry|scam|!!)' THEN v_sentiment := 'angry';
  ELSIF v_low ~ '(wrong|not working|cannot|can''t|didn''t|problem|issue|broken|still|stressed|worried|anxious)' THEN v_sentiment := 'negative';
  ELSIF v_low ~ '(thanks|thank you|great|love|happy)' THEN v_sentiment := 'positive';
  END IF;

  IF v_low ~ '(urgent|asap|immediately|right now|emergency)' OR v_flag = 'wellbeing' THEN v_urgency := 'critical';
  ELSIF v_sentiment IN ('angry','negative') THEN v_urgency := 'high';
  ELSIF v_intent = 'unknown' THEN v_urgency := 'low';
  END IF;

  IF v_uni THEN
    v_sensitive := v_flag IS NOT NULL OR v_low ~ '(legal|lawyer|delete my account)';
  ELSE
    v_sensitive := v_intent = 'refund_request'
                OR v_low ~ '(change my (bank|card|account)|delete my account|close my account|legal|lawyer)';
  END IF;
  v_risk := CASE WHEN v_injection THEN 'critical' WHEN v_sensitive THEN 'high'
                 WHEN v_sentiment = 'angry' THEN 'medium' ELSE 'low' END;
  v_priority := CASE WHEN v_flag = 'wellbeing' THEN 'urgent'
                     WHEN v_risk IN ('critical','high') OR v_urgency = 'critical' THEN 'high'
                     WHEN v_urgency = 'high' THEN 'medium'
                     WHEN v_intent = 'unknown' THEN 'low' ELSE 'normal' END;

  SELECT (value #>> '{}')::numeric INTO v_threshold FROM public.platform_settings WHERE setting_key = 'confidence_threshold';
  v_threshold := COALESCE(v_threshold, 0.70);

  -- ---------- find the best approved article in THIS pack's knowledge base ----------
  -- (English articles only: other languages go to a person who can help in that language)
  IF v_uni THEN
    v_cat := CASE WHEN v_intent IN ('admissions','fees','it_support','academic','student_services') THEN v_intent END;
  ELSE
    v_cat := CASE WHEN v_intent IN ('order_status','return_request') THEN 'orders'
                  WHEN v_intent IN ('billing_question','refund_request') THEN 'billing'
                  WHEN v_intent = 'technical_issue' THEN 'technical'
                  WHEN v_intent = 'account' THEN 'account' END;
  END IF;
  -- Words that say nothing about the topic are left out, so "Where can students
  -- park on campus?" does not match the Wi-Fi article just because of "campus".
  v_words := array_to_string(ARRAY(SELECT DISTINCT w FROM regexp_split_to_table(v_low, '[^a-z0-9]+') w
               WHERE length(w) >= 2 AND w NOT IN ('student','students','university','uni','northbridge','campus','semester',
                     'please','thanks','thank','time','day','week','weekend','weekends','much','many',
                     -- everyday words that say nothing about the topic
                     'bring','room','rooms','open','close','closes','get','need','use','find','know','people','guests')), ' or ');
  IF v_words <> '' AND v_lang = 'en' THEN
    v_query := websearch_to_tsquery('english', v_words);
    -- the answer ends with who to contact (the article's own contact, or its department's)
    SELECT d.document_id, d.title, d.version,
           d.content || COALESCE(E'\n\nWho to contact: ' || COALESCE(d.contact_role, p.role) || ', ' || COALESCE(d.contact_email, p.email)
                                 || COALESCE(' (' || p.hours || ')', ''), '')
      INTO v_doc_id, v_doc_title, v_doc_version, v_doc_content
    FROM public.knowledge_documents d
    LEFT JOIN public.departments p ON p.industry = d.industry AND p.category = d.category
    WHERE d.status = 'approved' AND d.industry = v_industry AND d.search @@ v_query
      -- the article's title or keywords must share a word with the question (not just its body text)
      AND to_tsvector('english', d.title || ' ' || d.keywords) @@ v_query
    ORDER BY ts_rank(d.search, v_query) + CASE WHEN d.category = v_cat THEN 0.3 ELSE 0 END DESC, d.updated_at DESC
    LIMIT 1;
  END IF;

  -- The best article is from another topic, or the question has no topic word:
  -- only trust a strong match (a word in the article's title, two of its keywords,
  -- or a general article). Otherwise a person answers instead of a wrong article.
  IF v_doc_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.knowledge_documents d WHERE d.document_id = v_doc_id AND (
         d.category IS NOT DISTINCT FROM v_cat OR
         d.category = 'general' OR to_tsvector('english', d.title) @@ v_query
         OR (SELECT count(*) FROM regexp_split_to_table(replace(v_words, ' or ', ' '), ' ') w
             WHERE CASE WHEN length(to_tsvector('english', w)) > 0   -- skip words like "the" (no notices)
                        THEN to_tsvector('english', d.keywords) @@ plainto_tsquery('english', w) ELSE false END) >= 2)) THEN
    v_doc_id := NULL; v_doc_title := NULL; v_doc_version := NULL; v_doc_content := NULL;
  END IF;

  -- No keyword topic, but a help article matched: take the topic from the article
  IF v_intent = 'unknown' AND v_doc_id IS NOT NULL THEN
    SELECT CASE WHEN v_uni THEN category
                ELSE CASE category WHEN 'orders' THEN 'order_status' WHEN 'billing' THEN 'billing_question'
                     WHEN 'technical' THEN 'technical_issue' WHEN 'account' THEN 'account' ELSE 'general' END END
    INTO v_intent FROM public.knowledge_documents WHERE document_id = v_doc_id;
    v_conf := 0.750;
    IF v_urgency = 'low' THEN v_urgency := 'medium'; END IF;
    v_priority := CASE WHEN v_priority = 'low' THEN 'normal' ELSE v_priority END;
  END IF;

  -- How sure are we? Based on how well the article matches the question:
  -- a word in its title and its keywords = very sure; keywords only = sure.
  IF v_doc_id IS NOT NULL THEN
    SELECT (to_tsvector('english', d.title) @@ v_query),
           (SELECT count(*) FROM regexp_split_to_table(replace(v_words, ' or ', ' '), ' ') w
            WHERE CASE WHEN length(to_tsvector('english', w)) > 0
                       THEN to_tsvector('english', d.keywords) @@ plainto_tsquery('english', w) ELSE false END)
    INTO v_title_hit, v_kw_hits FROM public.knowledge_documents d WHERE d.document_id = v_doc_id;
    v_conf := GREATEST(v_conf, CASE WHEN v_title_hit AND v_kw_hits >= 2 THEN 0.960
                                    WHEN v_title_hit OR v_kw_hits >= 2 THEN 0.920
                                    WHEN v_kw_hits = 1 THEN 0.860
                                    ELSE v_conf END);
  END IF;

  -- ---------- route (first matching active rule in this pack) ----------
  SELECT r.agent_id, a.name, a.department INTO v_agent_id, v_agent_name, v_dept
  FROM public.routing_rules r JOIN public.ai_agents a ON a.agent_id = r.agent_id
  WHERE r.status = 'active' AND r.action = 'route_to_agent' AND r.intent = v_intent AND a.status = 'active'
    AND a.agent_id IS DISTINCT FROM p_paused
    AND r.industry IN ('all', v_industry) AND a.industry IN ('all', v_industry)
  ORDER BY r.priority LIMIT 1;
  IF v_uni AND v_dept IS NULL THEN
    v_dept := CASE v_intent WHEN 'admissions' THEN 'Admissions' WHEN 'fees' THEN 'Student Finance'
                WHEN 'it_support' THEN 'IT Service Desk' WHEN 'academic' THEN 'Academic Services'
                ELSE 'Student Services' END;
  END IF;
  IF v_flag = 'wellbeing' THEN v_dept := 'Student Wellbeing';
  ELSIF v_flag = 'visa' THEN v_dept := 'International Student Advisers';
  END IF;

  RETURN jsonb_build_object(
    'industry', v_industry, 'uni', v_uni, 'text', v_text, 'language', v_lang,
    'intent', v_intent, 'sentiment', v_sentiment, 'urgency', v_urgency, 'risk', v_risk,
    'confidence', v_conf, 'priority', v_priority, 'injection', v_injection, 'sensitive', v_sensitive,
    'flag', v_flag, 'department', v_dept, 'agent_id', v_agent_id, 'agent_name', v_agent_name,
    'doc_id', v_doc_id, 'doc_title', v_doc_title, 'doc_version', v_doc_version, 'doc_content', v_doc_content,
    'asks_human', v_low ~ '(human|real person|speak to (an? )?(agent|someone))',
    -- the one reason a case is sensitive, for the duty-of-care report
    'safety_flag', COALESCE(CASE WHEN v_injection THEN 'injection' END, v_flag,
                     CASE WHEN v_sensitive AND v_intent = 'refund_request' THEN 'refund'
                          WHEN v_sensitive THEN 'account_change' END));
END $$;
REVOKE ALL ON FUNCTION private.classify_enquiry(text, text, uuid) FROM public, anon, authenticated;

-- ---------- replies in an existing chat ----------
DROP FUNCTION IF EXISTS public.customer_reply(uuid, text);
CREATE FUNCTION public.customer_reply(p_case_id uuid, p_message text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_cust   uuid := private.require_customer();
  v_user   uuid := private.my_user_id();
  v_text   text := trim(COALESCE(p_message, ''));
  v_case   record;
  v_agent  uuid;
  v_conv   uuid;
  v_c      jsonb;
  v_esc    jsonb;
  v_reply  uuid;
  v_who    text;
BEGIN
  SELECT case_id, case_number, status, industry INTO v_case FROM public.cases WHERE case_id = p_case_id AND customer_id = v_cust FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conversation not found' USING ERRCODE = '22023'; END IF;
  IF v_case.status = 'closed' THEN RAISE EXCEPTION 'This conversation is closed. Please start a new one.' USING ERRCODE = '22023'; END IF;
  IF char_length(v_text) < 2 OR char_length(v_text) > 2000 THEN
    RAISE EXCEPTION 'Please write between 2 and 2000 characters' USING ERRCODE = '22023';
  END IF;
  v_conv := private.case_conversation(p_case_id);
  v_who := CASE WHEN v_case.industry = 'university' THEN 'Student' ELSE 'Customer' END;
  INSERT INTO public.messages (conversation_id, sender_type, sender_id, content) VALUES (v_conv, 'customer', v_user, v_text);
  INSERT INTO public.audit_logs (user_id, actor, actor_type, action, entity_type, entity_id, case_id, result, risk_level)
  VALUES (v_user, v_who, 'human', 'customer_replied', 'cases', p_case_id, p_case_id, 'success', 'low');

  -- 1. a staff member is on the case: it goes to them
  SELECT user_id INTO v_agent FROM public.case_assignments WHERE case_id = p_case_id AND status = 'active' ORDER BY assigned_at DESC LIMIT 1;
  IF v_agent IS NOT NULL THEN
    UPDATE public.cases SET status = 'human_handling', updated_at = now() WHERE case_id = p_case_id;
    INSERT INTO public.notifications (user_id, type, title, case_id, link)
    VALUES (v_agent, 'customer_reply', left(v_case.case_number || ': customer replied', 120), p_case_id, '/cases/' || p_case_id);
    RETURN jsonb_build_object('answered', false, 'to', 'person');
  END IF;

  -- 2. the AI checks it like a new question
  v_c := private.classify_enquiry(v_text, v_case.industry);
  v_esc := private.pick_escalation(v_c);
  IF v_esc IS NULL AND v_c->>'doc_id' IS NOT NULL THEN
    INSERT INTO public.messages (conversation_id, sender_type, sender_id, content)
    VALUES (v_conv, 'ai_agent', (v_c->>'agent_id')::uuid, v_c->>'doc_content') RETURNING message_id INTO v_reply;
    INSERT INTO public.message_citations (message_id, document_id, section) VALUES (v_reply, (v_c->>'doc_id')::uuid, v_c->>'doc_title');
    INSERT INTO public.knowledge_retrievals (document_id, case_id, agent_id, relevance)
    VALUES ((v_c->>'doc_id')::uuid, p_case_id, (v_c->>'agent_id')::uuid, (v_c->>'confidence')::numeric);
    -- still waiting for a person? it stays in their queue; otherwise the AI keeps the chat
    UPDATE public.cases SET status = CASE WHEN status = 'escalated' THEN 'escalated' ELSE 'ai_handling' END, updated_at = now()
    WHERE case_id = p_case_id;
    INSERT INTO public.audit_logs (actor, actor_type, action, entity_type, entity_id, case_id, result, risk_level, details)
    VALUES (COALESCE(v_c->>'agent_name', 'Orchestrator'), 'ai_agent', 'replied_from_knowledge', 'cases', p_case_id, p_case_id, 'success', 'low',
            jsonb_build_object('follow_up', true, 'article', v_c->>'doc_title', 'confidence', v_c->>'confidence'));
    RETURN jsonb_build_object('answered', true, 'source', v_c->>'doc_title');
  END IF;

  -- 3. no safe answer, or it needs a person: pass it on, and say so in the chat
  INSERT INTO public.messages (conversation_id, sender_type, sender_id, content, message_type)
  VALUES (v_conv, 'system', NULL,
    CASE WHEN v_c->>'flag' = 'wellbeing' THEN
           'I''m sorry you are going through this, and thank you for telling us. I have passed your message to the Student Wellbeing team as urgent, and a person will contact you soon. If you are in immediate danger, call 000. You can talk to Lifeline any time on 13 11 14.'
         WHEN v_c->>'flag' = 'visa' THEN
           'I can only share general visa information, not advice about your own visa. I have passed your question to our International Student Advisers, who will reply here.'
         WHEN (v_c->>'sensitive')::boolean THEN
           'This needs approval from a staff member, so I have passed it to our team. A person will reply here.'
         ELSE 'I have passed this to ' || CASE WHEN v_case.industry = 'university' THEN 'the ' || COALESCE(v_c->>'department', 'Student Services') || ' team' ELSE 'our support team' END
              || ', and a person will reply here.' END,
    'escalation_notice');
  UPDATE public.cases SET status = 'escalated', updated_at = now(),
         safety_flag = COALESCE(safety_flag, v_c->>'safety_flag'),
         priority = CASE WHEN v_c->>'flag' = 'wellbeing' THEN 'urgent' ELSE priority END
  WHERE case_id = p_case_id;
  INSERT INTO public.notifications (user_id, type, title, case_id, link)
  SELECT u.user_id, 'customer_reply', left(v_case.case_number || ': customer replied', 120), p_case_id, '/cases/' || p_case_id
  FROM public.users u WHERE u.role IN ('support_agent', 'team_leader') AND u.status = 'active';
  INSERT INTO public.audit_logs (actor, actor_type, action, entity_type, entity_id, case_id, result, risk_level, details)
  VALUES ('Orchestrator', 'ai_agent', 'case_escalated', 'cases', p_case_id, p_case_id, 'success', COALESCE(v_c->>'risk', 'low'),
          jsonb_build_object('follow_up', true, 'rule', COALESCE(v_esc->>'name', 'No approved answer')));
  RETURN jsonb_build_object('answered', false, 'to', 'team');
END $$;
REVOKE EXECUTE ON FUNCTION public.customer_reply(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.customer_reply(uuid, text) TO authenticated;

COMMIT;
