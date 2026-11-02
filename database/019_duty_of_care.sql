-- =====================================================================
-- NexusCX AI - Migration 019: duty-of-care features
-- Run AFTER 018_visitor_industry.sql, once, in the Supabase SQL Editor.
--
-- What makes NexusCX different: it is built for organisations where a
-- wrong answer can hurt someone, and it can PROVE it behaves safely.
--
-- 1. The AI pipeline is split into two steps that change nothing
--    (plus one fix: an article must match the question's topic words,
--    so off-topic questions go to a person instead of a wrong article):
--      classify_enquiry() - understand the message, find the article and agent
--      pick_escalation()  - decide: answer, or pass to a person
--    handle_enquiry() uses both (same behaviour as before), and the
--    simulator can run them with "what if" settings.
-- 2. cases.safety_flag - why a case was sensitive (wellbeing, visa, refund...)
-- 3. simulate_rules()      "Test before you switch": replay real questions
--                          with proposed settings before saving them.
-- 4. knowledge_gaps()      Questions the AI could not answer, grouped by
--                          topic, so staff can write (and approve) articles.
-- 5. duty_of_care_report() Proof for managers: every sensitive case went
--                          to a person, and how fast.
-- 6. Sample questions with no article yet, so the gaps page has data.
-- =====================================================================
BEGIN;

-- ---------- 2. why a case was sensitive ----------
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS safety_flag varchar(20);

-- ---------- 1. the pipeline in two steps ----------
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
BEGIN
  v_uni  := v_industry = 'university';
  v_low  := lower(v_text);
  v_lang := private.detect_language(v_text);

  -- ---------- classify (rule-based keywords) ----------
  v_injection := v_low ~ '(ignore (all |your |the )?(previous|prior) instructions|system prompt|reveal (your|the|internal)|act as (an? )?admin|jailbreak)';

  IF v_uni THEN
    -- University departments. Order matters: safety topics first.
    IF v_low ~ '(suicid|self.?harm|kill myself|end my life|hurt myself|can.?t cope|cannot cope|overwhelmed|so stressed|really stressed|anxious|anxiety|depress|mental health|panic attack|not safe)' THEN
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
    ELSIF v_low ~ '(id card|student card|\mcard\M|lost my card|international student|orientation|accommodation|housing|career|resume|internship|\mclub|disability|access plan|parking|counsel|complaint|wellbeing)' THEN
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
                     'please','thanks','thank','time','day','week','weekend','weekends','much','many')), ' or ');
  IF v_words <> '' AND v_lang = 'en' THEN
    v_query := websearch_to_tsquery('english', v_words);
    SELECT d.document_id, d.title, d.version, d.content INTO v_doc_id, v_doc_title, v_doc_version, v_doc_content
    FROM public.knowledge_documents d
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

-- Which escalation rule (if any) applies to a classified message.
-- The optional settings let the simulator try "what if" values without saving them.
CREATE OR REPLACE FUNCTION private.pick_escalation(c jsonb, p_threshold numeric DEFAULT NULL,
  p_angry boolean DEFAULT NULL, p_high_risk boolean DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_rule    record;
  v_default numeric := COALESCE((SELECT (value #>> '{}')::numeric FROM public.platform_settings WHERE setting_key = 'confidence_threshold'), 0.70);
  v_on      boolean;
BEGIN
  FOR v_rule IN SELECT * FROM public.escalation_rules ORDER BY (condition_type = 'prompt_injection') DESC, priority LOOP
    v_on := CASE WHEN v_rule.condition_type = 'sentiment_equals' AND p_angry IS NOT NULL THEN p_angry
                 WHEN v_rule.condition_type = 'risk_equals' AND p_high_risk IS NOT NULL THEN p_high_risk
                 ELSE v_rule.status = 'active' END;
    CONTINUE WHEN NOT v_on;
    IF (v_rule.condition_type = 'prompt_injection'        AND (c->>'injection')::boolean)
    OR (v_rule.condition_type = 'risk_equals'             AND c->>'risk' = v_rule.threshold_value)
    OR (v_rule.condition_type = 'sensitive_action'        AND (c->>'sensitive')::boolean)
    OR (v_rule.condition_type = 'sentiment_equals'        AND c->>'sentiment' = v_rule.threshold_value)
    OR (v_rule.condition_type = 'urgency_equals'          AND c->>'urgency' = v_rule.threshold_value)
    OR (v_rule.condition_type = 'confidence_below'        AND (c->>'confidence')::numeric < COALESCE(p_threshold, v_rule.threshold_value::numeric, v_default))
    OR (v_rule.condition_type = 'customer_requests_human' AND (c->>'asks_human')::boolean)
    OR (v_rule.condition_type = 'agent_cannot_answer'     AND (c->>'agent_id' IS NULL OR c->>'doc_id' IS NULL)) THEN
      RETURN jsonb_build_object('rule_id', v_rule.rule_id, 'name', v_rule.name, 'hard_stop', false);
    END IF;
  END LOOP;
  -- Hard stops: wellbeing and personal visa questions ALWAYS go to a person, whatever the settings
  IF c->>'flag' IN ('wellbeing', 'visa') THEN
    RETURN (SELECT jsonb_build_object('rule_id', rule_id, 'name', name, 'hard_stop', true)
            FROM public.escalation_rules WHERE condition_type = 'sensitive_action')
           || '{"hard_stop": true}'::jsonb;
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.pick_escalation(jsonb, numeric, boolean, boolean) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION private.handle_enquiry(p_customer uuid, p_user uuid, p_message text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_industry    text := public.current_industry();
  v_uni         boolean;
  v_text        text := trim(COALESCE(p_message, ''));
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
  v_c           jsonb;
  v_esc         jsonb;
BEGIN
  v_uni  := v_industry = 'university';
  v_low  := lower(v_text);
  -- 1. understand the message (no changes made)
  v_c := private.classify_enquiry(v_text, v_industry);
  v_lang := v_c->>'language'; v_intent := v_c->>'intent'; v_sentiment := v_c->>'sentiment';
  v_urgency := v_c->>'urgency'; v_risk := v_c->>'risk'; v_conf := (v_c->>'confidence')::numeric;
  v_priority := v_c->>'priority'; v_injection := (v_c->>'injection')::boolean; v_sensitive := (v_c->>'sensitive')::boolean;
  v_flag := v_c->>'flag'; v_dept := v_c->>'department'; v_agent_id := (v_c->>'agent_id')::uuid; v_agent_name := v_c->>'agent_name';
  v_doc_id := (v_c->>'doc_id')::uuid; v_doc_title := v_c->>'doc_title'; v_doc_version := v_c->>'doc_version'; v_doc_content := v_c->>'doc_content';


  -- ---------- create case, conversation, customer message ----------
  SELECT resolution_minutes INTO v_sla_minutes FROM public.sla_policies WHERE priority = v_priority;
  INSERT INTO public.cases (customer_id, status, priority, intent, sentiment, urgency, risk, confidence,
                            subject, assigned_agent_id, sla_due_at, language, industry, safety_flag)
  VALUES (p_customer, 'ai_handling', v_priority, v_intent, v_sentiment, v_urgency, v_risk, v_conf,
          left(v_text, 200), v_agent_id, now() + make_interval(mins => COALESCE(v_sla_minutes, 480)), v_lang, v_industry, v_c->>'safety_flag')
  RETURNING case_id, case_number INTO v_case_id, v_case_number;

  INSERT INTO public.conversations (case_id, channel) VALUES (v_case_id, 'web_chat') RETURNING conversation_id INTO v_conv_id;
  INSERT INTO public.messages (conversation_id, sender_type, sender_id, content)
  VALUES (v_conv_id, 'customer', p_user, v_text) RETURNING message_id INTO v_msg_id;

  INSERT INTO public.classifications (case_id, agent_id, intent, sentiment, urgency, risk, language, confidence)
  VALUES (v_case_id, '00000000-0000-0000-0000-000000000202', v_intent, v_sentiment, v_urgency, v_risk, v_lang, v_conf);
  INSERT INTO public.audit_logs (actor, actor_type, action, entity_type, entity_id, case_id, result, risk_level, details)
  VALUES ('Intent Classifier', 'ai_agent', 'classified_intent', 'cases', v_case_id, v_case_id, 'success', v_risk,
          jsonb_build_object('intent', v_intent, 'language', v_lang, 'confidence', v_conf, 'routed_to', v_agent_name, 'industry', v_industry));

  -- 2. decide: answer, or pass to a person (escalation rules + hard stops)
  v_esc := private.pick_escalation(v_c);
  v_esc_id := (v_esc->>'rule_id')::uuid;
  v_esc_name := v_esc->>'name';

  IF v_esc_id IS NOT NULL THEN
    v_status := 'escalated';
    UPDATE public.cases SET status = 'escalated', assigned_agent_id = NULL WHERE case_id = v_case_id;
    INSERT INTO public.escalations (case_id, reason, escalated_from, escalated_to, rule_id)
    VALUES (v_case_id, v_esc_name, COALESCE(v_agent_name, 'Orchestrator'), 'human_support_queue', v_esc_id);

    v_lang_name := CASE v_lang WHEN 'ne' THEN 'Nepali' WHEN 'hi' THEN 'Hindi' WHEN 'zh' THEN 'Chinese' WHEN 'ja' THEN 'Japanese'
                     WHEN 'ko' THEN 'Korean' WHEN 'ar' THEN 'Arabic' WHEN 'th' THEN 'Thai' WHEN 'vi' THEN 'Vietnamese'
                     WHEN 'es' THEN 'Spanish' END;
    IF v_injection THEN
      INSERT INTO public.security_events (event_type, case_id, message_id, severity, description, action_taken)
      VALUES ('prompt_injection', v_case_id, v_msg_id, 'high', left(v_text, 300), 'Blocked; case sent to human review');
      v_reply := 'For your security this request has been passed to our support team. A person will reply shortly.';
    ELSIF v_flag = 'wellbeing' THEN
      v_reply := 'I''m sorry you are going through this, and thank you for telling us. I have passed your message to the Student Wellbeing team as urgent, and a person will contact you soon. If you are in immediate danger, call 000. You can talk to Lifeline any time on 13 11 14.';
    ELSIF v_flag = 'visa' THEN
      v_reply := 'I can only share general visa information, not advice about your own visa. I have passed your question to our International Student Advisers, who will reply here. The official rules are on the Department of Home Affairs website (homeaffairs.gov.au).';
    ELSIF v_lang <> 'en' THEN
      v_reply := 'Thank you for your message' || CASE WHEN v_lang_name IS NOT NULL THEN ' in ' || v_lang_name ELSE '' END
              || '. I have passed it to a member of our team, who will reply as soon as possible.';
    ELSIF v_uni AND v_flag IS NOT NULL THEN
      v_reply := 'This needs a decision from a staff member, so I have passed it to the ' || v_dept || ' team. They will reply here shortly.';
    ELSIF v_sensitive THEN
      v_reply := 'This request needs approval from a staff member, so I have passed it to our support team. Estimated wait: a few minutes.';
      INSERT INTO public.audit_logs (actor, actor_type, action, entity_type, entity_id, case_id, result, risk_level)
      VALUES ('Policy Engine', 'system', 'restricted_action_blocked', 'cases', v_case_id, v_case_id, 'blocked', 'high');
    ELSIF v_esc_name = 'Customer Asks Human' THEN
      v_reply := 'Of course. I have passed your request to ' || CASE WHEN v_uni THEN 'the ' || v_dept || ' team' ELSE 'a member of our support team' END
              || ', who will reply here shortly.';
    ELSIF v_doc_id IS NULL THEN
      v_reply := 'I could not find an approved answer for that, so I have passed it to '
              || CASE WHEN v_uni THEN 'the ' || v_dept || ' team' ELSE 'a member of our support team' END || '. They will reply here shortly.';
    ELSE
      v_reply := 'I have passed your request to ' || CASE WHEN v_uni THEN 'the ' || v_dept || ' team' ELSE 'a member of our support team' END
              || ', who will reply shortly.';
    END IF;
    IF v_uni AND v_flag IS NOT NULL THEN
      INSERT INTO public.audit_logs (actor, actor_type, action, entity_type, entity_id, case_id, result, risk_level, details)
      VALUES ('Policy Engine', 'system', 'restricted_action_blocked', 'cases', v_case_id, v_case_id, 'blocked', 'high',
              jsonb_build_object('reason', v_flag, 'department', v_dept));
    END IF;

    INSERT INTO public.messages (conversation_id, sender_type, sender_id, content, message_type)
    VALUES (v_conv_id, 'system', NULL, v_reply, 'escalation_notice');
    INSERT INTO public.audit_logs (actor, actor_type, action, entity_type, entity_id, case_id, result, risk_level, details)
    VALUES ('Orchestrator', 'ai_agent', 'case_escalated', 'cases', v_case_id, v_case_id, 'success', v_risk,
            jsonb_build_object('rule', v_esc_name, 'department', v_dept));
    INSERT INTO public.notifications (user_id, type, title, case_id)
    SELECT u.user_id, 'new_escalation', v_case_number || ': ' || v_esc_name, v_case_id
    FROM public.users u WHERE u.role IN ('support_agent','team_leader') AND u.status = 'active';
  ELSE
    -- ---------- reply from the approved article found above ----------
    v_reply := COALESCE(v_doc_content, 'I could not find approved information for this, so I have passed it to our support team.');
    INSERT INTO public.messages (conversation_id, sender_type, sender_id, content)
    VALUES (v_conv_id, 'ai_agent', v_agent_id, v_reply) RETURNING message_id INTO v_reply_id;
    UPDATE public.cases SET first_response_at = now() WHERE case_id = v_case_id;
    IF v_doc_id IS NOT NULL THEN
      INSERT INTO public.message_citations (message_id, document_id, section) VALUES (v_reply_id, v_doc_id, v_doc_title);
      INSERT INTO public.knowledge_retrievals (document_id, case_id, agent_id, relevance)
      VALUES (v_doc_id, v_case_id, v_agent_id, v_conf);
    END IF;
    INSERT INTO public.audit_logs (actor, actor_type, action, entity_type, entity_id, case_id, result, risk_level)
    VALUES (COALESCE(v_agent_name, 'Orchestrator'), 'ai_agent', 'replied_from_knowledge', 'cases', v_case_id, v_case_id, 'success', 'low');
  END IF;
  RETURN jsonb_build_object(
    'case_id', v_case_id, 'case_number', v_case_number, 'status', v_status,
    'intent', v_intent, 'sentiment', v_sentiment, 'urgency', v_urgency, 'risk', v_risk, 'language', v_lang,
    'confidence', v_conf, 'routed_to', COALESCE(v_agent_name, 'Human Queue'), 'department', v_dept,
    'escalation_rule', v_esc_name, 'reply', v_reply,
    'source', CASE WHEN v_doc_id IS NOT NULL AND v_status = 'ai_handling' THEN v_doc_title || ' ' || v_doc_version END);
END $$;
REVOKE ALL ON FUNCTION private.handle_enquiry(uuid, uuid, text) FROM public, anon, authenticated;

-- Fill safety_flag for existing cases from their first message
UPDATE public.cases c
SET safety_flag = private.classify_enquiry(COALESCE(
      (SELECT m.content FROM public.messages m JOIN public.conversations v ON v.conversation_id = m.conversation_id
       WHERE v.case_id = c.case_id AND m.sender_type = 'customer' ORDER BY m.sent_at LIMIT 1), c.subject, ''), c.industry)->>'safety_flag'
WHERE c.safety_flag IS NULL;

-- The first thing the person wrote (the question we replay)
CREATE OR REPLACE FUNCTION private.first_question(p_case uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE(
    (SELECT m.content FROM public.messages m JOIN public.conversations v ON v.conversation_id = m.conversation_id
     WHERE v.case_id = p_case AND m.sender_type = 'customer' ORDER BY m.sent_at LIMIT 1),
    (SELECT subject FROM public.cases WHERE case_id = p_case), '')
$$;

-- ---------- 3. Test before you switch ----------
CREATE OR REPLACE FUNCTION public.simulate_rules(p_days int DEFAULT 30, p_threshold numeric DEFAULT NULL,
  p_angry boolean DEFAULT NULL, p_high_risk boolean DEFAULT NULL, p_paused uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_ind     text := public.current_industry();
  v_days    int  := CASE WHEN p_days IN (7, 30, 90) THEN p_days ELSE 30 END;
  r         record;
  v_q       text;
  v_now     jsonb;
  v_new     jsonb;
  v_cnow    jsonb;
  v_cnew    jsonb;
  v_total   int := 0; v_now_ai int := 0; v_new_ai int := 0; v_hard int := 0;
  v_changed jsonb := '[]';
  v_reasons jsonb := '{}';
BEGIN
  IF NOT (private.has_permission('configure_ai') OR private.has_permission('view_analytics')) THEN
    RAISE EXCEPTION 'You do not have permission to run the simulator.' USING ERRCODE = '42501';
  END IF;
  IF p_threshold IS NOT NULL AND (p_threshold < 0.3 OR p_threshold > 0.95) THEN
    RAISE EXCEPTION 'Confidence must be between 0.30 and 0.95.' USING ERRCODE = '22023';
  END IF;

  FOR r IN SELECT case_id, case_number FROM public.cases
           WHERE industry = v_ind AND created_at >= now() - make_interval(days => v_days)
           ORDER BY created_at DESC LIMIT 500 LOOP
    v_q := private.first_question(r.case_id);
    CONTINUE WHEN length(v_q) < 5;
    v_total := v_total + 1;
    v_cnow := private.classify_enquiry(v_q, v_ind);
    v_now  := private.pick_escalation(v_cnow);
    v_cnew := CASE WHEN p_paused IS NULL THEN v_cnow ELSE private.classify_enquiry(v_q, v_ind, p_paused) END;
    v_new  := private.pick_escalation(v_cnew, p_threshold, p_angry, p_high_risk);
    IF v_now IS NULL THEN v_now_ai := v_now_ai + 1; END IF;
    IF v_new IS NULL THEN v_new_ai := v_new_ai + 1;
    ELSE v_reasons := jsonb_set(v_reasons, ARRAY[v_new->>'name'], to_jsonb(COALESCE((v_reasons->>(v_new->>'name'))::int, 0) + 1));
    END IF;
    IF v_cnew->>'flag' IN ('wellbeing', 'visa') THEN v_hard := v_hard + 1; END IF;
    IF (v_now IS NULL) <> (v_new IS NULL) OR v_now->>'name' IS DISTINCT FROM v_new->>'name' THEN
      v_changed := v_changed || jsonb_build_object('case_number', r.case_number, 'question', left(v_q, 140),
        'before', COALESCE(v_now->>'name', 'AI answers'), 'after', COALESCE(v_new->>'name', 'AI answers'),
        'to_person', v_new IS NOT NULL);
    END IF;
  END LOOP;

  RETURN jsonb_build_object('days', v_days, 'total', v_total,
    'now', jsonb_build_object('ai', v_now_ai, 'person', v_total - v_now_ai),
    'proposed', jsonb_build_object('ai', v_new_ai, 'person', v_total - v_new_ai),
    'hard_stops', v_hard, 'reasons', v_reasons,
    'changed', (SELECT COALESCE(jsonb_agg(x), '[]') FROM (SELECT x FROM jsonb_array_elements(v_changed) x LIMIT 40) s));
END $$;
REVOKE ALL ON FUNCTION public.simulate_rules(int, numeric, boolean, boolean, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.simulate_rules(int, numeric, boolean, boolean, uuid) TO authenticated;

-- ---------- 4. Knowledge gaps ----------
-- Questions that went to a person because no approved article fitted
-- (checked again against TODAY's articles, so a gap disappears once an
-- article is approved), grouped by their most common word.
CREATE OR REPLACE FUNCTION public.knowledge_gaps(p_days int DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_ind    text := public.current_industry();
  v_days   int  := CASE WHEN p_days IN (7, 30, 90) THEN p_days ELSE 30 END;
  v_stop   text[] := ARRAY['about','after','again','also','am','an','and','any','are','because','been','before','can','cannot','could','did','does','dont','from','get','have','hello','help','here','how','into','just','know','like','long','many','more','much','need','please','should','some','still','than','thank','thanks','that','the','their','them','then','there','they','this','what','when','where','which','while','will','with','would','your','yours','want','there','time','tell','able','next','week','today','student','students','university','northbridge','customer','order','someone','anyone','going','make','other','only','very','find','give','campus','semester','free','near','cost','book','bring','close','open'];
  v_stems  text[];
  v_label  text;
  v_left   jsonb := '[]';
  v_groups jsonb := '[]';
  v_word   text;
  v_hits   jsonb;
  r        record;
  c        jsonb;
  n        int := 0;
BEGIN
  IF NOT private.has_permission('manage_knowledge') THEN
    RAISE EXCEPTION 'You do not have permission to view knowledge gaps.' USING ERRCODE = '42501';
  END IF;
  SELECT array_agg(x.lexeme) INTO v_stems FROM unnest(to_tsvector('english', array_to_string(v_stop, ' '))) x;
  -- unanswered questions (English, not a safety case)
  FOR r IN SELECT k.case_id, k.case_number, k.created_at FROM public.cases k
           WHERE k.industry = v_ind AND k.created_at >= now() - make_interval(days => v_days)
             AND k.language = 'en' AND k.safety_flag IS NULL
             AND EXISTS (SELECT 1 FROM public.escalations e WHERE e.case_id = k.case_id
                         AND e.reason IN ('Agent Cannot Answer', 'Low Confidence'))
           ORDER BY k.created_at DESC LIMIT 300 LOOP
    c := private.classify_enquiry(private.first_question(r.case_id), v_ind);
    CONTINUE WHEN c->>'doc_id' IS NOT NULL;   -- an approved article now answers it
    -- word stems, so "park" and "parking" count as the same topic
    v_left := v_left || jsonb_build_object('case_number', r.case_number, 'question', c->>'text', 'intent', c->>'intent',
      'words', (SELECT jsonb_agg(DISTINCT x.lexeme) FROM unnest(to_tsvector('english', c->>'text')) x
                WHERE length(x.lexeme) >= 3 AND NOT (x.lexeme = ANY (v_stems))));
    n := n + 1;
  END LOOP;

  -- greedy grouping: the word shared by most questions, then the next, ...
  WHILE jsonb_array_length(v_left) > 0 AND jsonb_array_length(v_groups) < 8 LOOP
    SELECT w INTO v_word FROM jsonb_array_elements(v_left) q, jsonb_array_elements_text(COALESCE(q->'words', '[]')) w
    GROUP BY w ORDER BY count(*) DESC, w LIMIT 1;
    EXIT WHEN v_word IS NULL;
    SELECT jsonb_agg(q) INTO v_hits FROM jsonb_array_elements(v_left) q WHERE q->'words' ? v_word;
    -- show a real word, not the stem ("library", not "librari")
    SELECT w INTO v_label FROM jsonb_array_elements(v_hits) q, regexp_split_to_table(lower(q->>'question'), '[^a-z]+') w
    WHERE w <> '' AND to_tsvector('english', w) @@ to_tsquery('english', v_word) ORDER BY length(w) DESC LIMIT 1;
    v_groups := v_groups || jsonb_build_object(
      'topic', COALESCE(v_label, v_word), 'count', jsonb_array_length(v_hits),
      'intent', (SELECT q->>'intent' FROM jsonb_array_elements(v_hits) q GROUP BY 1 ORDER BY count(*) DESC LIMIT 1),
      'questions', (SELECT jsonb_agg(q->>'question') FROM (SELECT q FROM jsonb_array_elements(v_hits) q LIMIT 4) s),
      'cases', (SELECT jsonb_agg(q->>'case_number') FROM jsonb_array_elements(v_hits) q));
    SELECT COALESCE(jsonb_agg(q), '[]') INTO v_left FROM jsonb_array_elements(v_left) q WHERE NOT (q->'words' ? v_word);
    v_word := NULL;
  END LOOP;

  RETURN jsonb_build_object('days', v_days, 'unanswered', n, 'groups', v_groups);
END $$;
REVOKE ALL ON FUNCTION public.knowledge_gaps(int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.knowledge_gaps(int) TO authenticated;

-- ---------- 5. Duty-of-care report ----------
CREATE OR REPLACE FUNCTION public.duty_of_care_report(p_days int DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_ind  text := public.current_industry();
  v_days int  := CASE WHEN p_days IN (7, 30, 90) THEN p_days ELSE 30 END;
  v_from timestamptz := now() - make_interval(days => v_days);
BEGIN
  IF NOT private.has_permission('view_analytics') THEN
    RAISE EXCEPTION 'You do not have permission to view this report.' USING ERRCODE = '42501';
  END IF;
  RETURN (
    WITH k AS (
      SELECT c.case_id, c.case_number, c.safety_flag, c.priority, c.status, c.language, c.created_at, c.risk,
             EXISTS (SELECT 1 FROM public.escalations e WHERE e.case_id = c.case_id) AS to_person,
             (SELECT min(e.created_at) FROM public.escalations e WHERE e.case_id = c.case_id) AS escalated_at,
             -- first time a person picked it up: took the case or replied
             (SELECT min(t) FROM (
                SELECT min(a.assigned_at) AS t FROM public.case_assignments a WHERE a.case_id = c.case_id
                UNION ALL
                SELECT min(m.sent_at) FROM public.messages m JOIN public.conversations v ON v.conversation_id = m.conversation_id
                WHERE v.case_id = c.case_id AND m.sender_type = 'human_agent') s) AS picked_at,
             (SELECT p.first_response_minutes FROM public.sla_policies p WHERE p.priority = c.priority) AS target_min
      FROM public.cases c WHERE c.industry = v_ind AND c.created_at >= v_from
    ), w AS (
      SELECT *, round(extract(epoch FROM picked_at - escalated_at) / 60)::int AS pickup_min FROM k
    )
    SELECT jsonb_build_object(
      'days', v_days, 'industry', v_ind, 'generated_at', now(),
      'cases', count(*),
      'ai_answered', count(*) FILTER (WHERE NOT to_person),
      'to_person', count(*) FILTER (WHERE to_person),
      'sensitive', count(*) FILTER (WHERE safety_flag IS NOT NULL),
      'sensitive_ai_only', count(*) FILTER (WHERE safety_flag IS NOT NULL AND NOT to_person),
      'by_flag', COALESCE((SELECT jsonb_object_agg(f, n) FROM (SELECT safety_flag AS f, count(*) AS n FROM w
                   WHERE safety_flag IS NOT NULL GROUP BY 1) x), '{}'),
      'picked_up', count(*) FILTER (WHERE to_person AND picked_at IS NOT NULL),
      'waiting_now', count(*) FILTER (WHERE to_person AND picked_at IS NULL AND status NOT IN ('resolved','closed')),
      'median_pickup_min', percentile_cont(0.5) WITHIN GROUP (ORDER BY pickup_min) FILTER (WHERE to_person AND pickup_min IS NOT NULL),
      'within_target', count(*) FILTER (WHERE to_person AND pickup_min IS NOT NULL AND pickup_min <= target_min),
      'wellbeing', jsonb_build_object(
          'cases', count(*) FILTER (WHERE safety_flag = 'wellbeing'),
          'urgent', count(*) FILTER (WHERE safety_flag = 'wellbeing' AND priority = 'urgent'),
          'median_pickup_min', percentile_cont(0.5) WITHIN GROUP (ORDER BY pickup_min) FILTER (WHERE safety_flag = 'wellbeing' AND pickup_min IS NOT NULL),
          'waiting_now', count(*) FILTER (WHERE safety_flag = 'wellbeing' AND picked_at IS NULL AND status NOT IN ('resolved','closed'))),
      'other_languages', count(*) FILTER (WHERE language <> 'en'),
      'other_languages_to_person', count(*) FILTER (WHERE language <> 'en' AND to_person),
      'injections_blocked', (SELECT count(*) FROM public.security_events s JOIN public.cases c ON c.case_id = s.case_id
                             WHERE c.industry = v_ind AND s.created_at >= v_from AND s.event_type = 'prompt_injection'),
      'audit_entries', (SELECT count(*) FROM public.audit_logs a JOIN public.cases c ON c.case_id = a.case_id
                        WHERE c.industry = v_ind AND a.created_at >= v_from),
      'list', COALESCE((SELECT jsonb_agg(jsonb_build_object('case_id', case_id, 'case_number', case_number, 'flag', safety_flag,
                 'priority', priority, 'status', status, 'created_at', created_at, 'to_person', to_person,
                 'pickup_min', pickup_min, 'target_min', target_min) ORDER BY created_at DESC)
                FROM w WHERE safety_flag IS NOT NULL), '[]'))
    FROM w);
END $$;
REVOKE ALL ON FUNCTION public.duty_of_care_report(int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.duty_of_care_report(int) TO authenticated;

-- ---------- 6. sample data for the demo (only once) ----------
DO $$
DECLARE
  v_was  jsonb := (SELECT value FROM public.platform_settings WHERE setting_key = 'industry');
  v_cust uuid[];
  v_user uuid;
  v_staff uuid := (SELECT user_id FROM public.users WHERE role = 'support_agent' AND status = 'active' ORDER BY name LIMIT 1);
  v_r    jsonb;
  s      record;
  e      record;
  v_i    int := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM public.cases WHERE industry = 'university' AND subject ILIKE '%parking%') THEN RETURN; END IF;
  SELECT array_agg(c.customer_id ORDER BY u.name) INTO v_cust
  FROM public.customers c JOIN public.users u ON u.user_id = c.user_id WHERE u.role = 'customer' AND u.status = 'active';
  IF v_cust IS NULL THEN RETURN; END IF;

  -- a) questions Northbridge has no article for yet -> knowledge gaps
  UPDATE public.platform_settings SET value = '"university"' WHERE setting_key = 'industry';
  FOR s IN SELECT * FROM (VALUES
    ('Where can students park on campus?', 14),
    ('How much does a parking permit cost per semester?', 11),
    ('Is there free parking near the library?', 8),
    ('What time does the library close on weekends?', 12),
    ('Can I book a quiet study room in the library?', 5),
    ('How do I hire a gown for my graduation ceremony?', 9),
    ('How many guests can I bring to graduation?', 3),
    ('Is there a prayer room on campus?', 6)
  ) AS t(msg, days_ago) LOOP
    v_i := v_i + 1;
    SELECT user_id INTO v_user FROM public.customers WHERE customer_id = v_cust[1 + (v_i % array_length(v_cust, 1))];
    v_r := private.handle_enquiry(v_cust[1 + (v_i % array_length(v_cust, 1))], v_user, s.msg);
    UPDATE public.cases SET created_at = now() - make_interval(days => s.days_ago, hours => v_i), updated_at = now() - make_interval(days => s.days_ago)
     WHERE case_id = (v_r->>'case_id')::uuid;
    UPDATE public.messages SET sent_at = now() - make_interval(days => s.days_ago, hours => v_i)
     WHERE conversation_id IN (SELECT conversation_id FROM public.conversations WHERE case_id = (v_r->>'case_id')::uuid);
    UPDATE public.escalations SET created_at = now() - make_interval(days => s.days_ago, hours => v_i)
     WHERE case_id = (v_r->>'case_id')::uuid;
  END LOOP;
  UPDATE public.platform_settings SET value = v_was WHERE setting_key = 'industry';

  -- b) a person picked up and resolved each older sample university case that went to staff
  --    (wellbeing within minutes), so the duty-of-care report has real timings
  IF v_staff IS NOT NULL THEN
    FOR e IN SELECT c.case_id, c.safety_flag, min(x.created_at) AS at, (SELECT conversation_id FROM public.conversations v WHERE v.case_id = c.case_id LIMIT 1) AS conv
             FROM public.cases c JOIN public.escalations x ON x.case_id = c.case_id
             WHERE c.industry = 'university' AND c.created_at < now() - interval '2 days'
               AND NOT EXISTS (SELECT 1 FROM public.case_assignments a WHERE a.case_id = c.case_id)
             GROUP BY c.case_id, c.safety_flag LOOP
      INSERT INTO public.case_assignments (case_id, user_id, assigned_at, status)
      VALUES (e.case_id, v_staff, e.at + CASE WHEN e.safety_flag = 'wellbeing' THEN interval '4 minutes' ELSE interval '11 minutes' END, 'completed');
      INSERT INTO public.messages (conversation_id, sender_type, sender_id, content, sent_at)
      VALUES (e.conv, 'human_agent', v_staff,
              CASE WHEN e.safety_flag = 'wellbeing'
                   THEN 'Hi, this is the Student Wellbeing team. Thank you for reaching out. I have booked you a counselling call this afternoon and our team will call you shortly.'
                   ELSE 'Hi, thanks for your patience. I have looked into this for you and the details are below. Let us know if anything is unclear.' END,
              e.at + CASE WHEN e.safety_flag = 'wellbeing' THEN interval '6 minutes' ELSE interval '15 minutes' END);
      UPDATE public.cases SET status = 'resolved' WHERE case_id = e.case_id AND status NOT IN ('resolved', 'closed');
      UPDATE public.cases SET resolved_at = e.at + interval '40 minutes', updated_at = e.at + interval '40 minutes' WHERE case_id = e.case_id;
    END LOOP;
  END IF;
END $$;

COMMIT;
