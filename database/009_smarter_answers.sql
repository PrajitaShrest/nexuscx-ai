-- =====================================================================
-- NexusCX AI - Migration 009: smarter answers from the knowledge base
-- Run AFTER 008_admin_controls.sql, once, in the Supabase SQL Editor.
--
-- Problem: the assistant picked ONE article per topic, so every billing
-- question got the refund policy, and account questions had no answer.
--
-- 1. knowledge_documents.keywords + a full-text search column (title,
--    keywords and content), with an index.
-- 2. 20 more approved help articles (sample policies for the demo store).
-- 3. Routing for account and general questions.
-- 4. submit_enquiry() now searches for the best article for the actual
--    question. If nothing matches, the case goes to a person
--    ("Agent Cannot Answer") instead of giving a wrong answer.
--    Still answers ONLY from approved articles.
-- =====================================================================
BEGIN;

-- ---------- 1. search column ----------
ALTER TABLE public.knowledge_documents ADD COLUMN IF NOT EXISTS keywords TEXT NOT NULL DEFAULT '';
ALTER TABLE public.knowledge_documents ADD COLUMN search tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(keywords, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'B')) STORED;
CREATE INDEX idx_knowledge_search ON public.knowledge_documents USING gin (search);

-- Keywords for the existing articles
UPDATE public.knowledge_documents SET keywords = 'shipping delivery parcel package arrive late tracking days when'
  WHERE title = 'Delivery times policy';
UPDATE public.knowledge_documents SET keywords = 'return send back refund exchange 30 days receipt'
  WHERE title = 'Returns policy';
UPDATE public.knowledge_documents SET keywords = 'forgot password reset login sign in locked link'
  WHERE title = 'Password reset FAQ';
UPDATE public.knowledge_documents SET keywords = 'refund money back charged twice double charge'
  WHERE title = 'Refund policy';

-- ---------- 2. more approved articles ----------
INSERT INTO public.knowledge_documents (title, category, keywords, content, status, version, owner, approved_by, approved_at, source)
SELECT a.title, a.category, a.keywords, a.content, 'approved', 'v1.0', 'Knowledge Team',
       (SELECT user_id FROM public.users WHERE role = 'knowledge_manager' ORDER BY name LIMIT 1), now(), 'NexusCX Help Centre'
FROM (VALUES
  -- orders
  ('Tracking your order', 'orders', 'where is my order track tracking number status parcel',
   'You can track your order any time under My Account > Orders. Select the order to see its tracking number and the latest update from the courier. Tracking usually appears within 24 hours of your order being shipped.'),
  ('Late or missing parcel', 'orders', 'not arrived missing late lost parcel delivered but not received',
   'If your parcel has not arrived 2 business days after the expected date, first check the tracking page and your safe-place or neighbour. If it still cannot be found, reply here with your order number and our team will open a courier investigation.'),
  ('Changing your delivery address', 'orders', 'change address delivery address wrong address update shipping',
   'You can change the delivery address while the order status is Processing. Go to My Account > Orders, select the order and choose Edit address. Once the order has shipped, the address can only be changed by the courier.'),
  ('Cancelling an order', 'orders', 'cancel cancellation stop order',
   'Orders can be cancelled while they are still Processing: go to My Account > Orders and choose Cancel order. Once an order has shipped it cannot be cancelled, but you can return it within 30 days.'),
  ('Exchanges and sizes', 'orders', 'exchange swap size colour different size wrong size',
   'To exchange an item for a different size or colour, start a return under My Account > Orders and choose Exchange. We send the new item as soon as the original is scanned by the courier.'),
  ('How long returns take', 'orders', 'return processed processing how long return status',
   'Returns are processed within 5 business days of reaching our warehouse. You will get an email when your return is processed. Any approved refund then takes 3 to 5 business days to appear on your statement.'),
  -- billing
  ('Invoices and receipts', 'billing', 'invoice receipt copy tax invoice bill download pdf',
   'You can download a tax invoice for any order under My Account > Orders: select the order and choose Download invoice. Invoices are also emailed to you when the order ships.'),
  ('Updating your payment method', 'billing', 'payment method card update change credit card debit card expired',
   'To update your card, go to My Account > Payment methods and choose Add card. Set the new card as default, then remove the old one. We never see or store your full card number.'),
  ('Accepted payment methods', 'billing', 'pay paypal afterpay visa mastercard amex payment options',
   'We accept Visa, Mastercard, American Express, PayPal and Afterpay. All prices are in Australian dollars and include GST.'),
  ('Unexpected or pending charges', 'billing', 'pending charge unknown charge authorisation hold charge i do not recognise',
   'A pending charge is a temporary hold by your bank while your order is confirmed. It usually drops off within 3 to 5 business days. If you still see a charge you do not recognise, reply here and a person will check it for you.'),
  -- technical
  ('Trouble signing in', 'technical', 'cannot log in login sign in locked out account locked',
   'Check that Caps Lock is off and that you are using your username or email. After 5 wrong passwords, your account is locked for 15 minutes for your safety. You can also use Forgot password on the sign-in page.'),
  ('App crashing or not loading', 'technical', 'app crash crashing not loading freeze slow error website broken',
   'Please update the app to the latest version, then close and reopen it. On the website, try refreshing the page or clearing your browser cache. If the problem continues, tell us your device and browser and we will investigate.'),
  ('Email notifications not arriving', 'technical', 'no email not receiving emails spam junk notification confirmation',
   'Check your spam or junk folder and add our address to your contacts. Make sure the email in My Account > Profile is correct. Emails can take up to 10 minutes to arrive.'),
  -- account
  ('Changing your email address', 'account', 'change email email address update email new email',
   'Go to My Account > Profile, choose Change email and enter your new address. We send a confirmation link to the new address; the change takes effect once you click it.'),
  ('Updating your profile', 'account', 'profile name phone number update details edit',
   'You can update your name and phone number any time under My Account > Profile. Your username can be changed once every 30 days.'),
  ('Keeping your account secure', 'account', 'security secure safe hacked suspicious phishing scam',
   'We will never ask for your password by email, phone or chat. Use a password you do not use anywhere else. If you notice anything suspicious, change your password straight away and tell us here.'),
  ('Privacy and your data', 'account', 'privacy data personal information delete data download data',
   'We only use your details to provide your orders and support. You can read how we handle your data in our Privacy Policy. To request a copy of your data, ask here and our team will help.'),
  -- general
  ('Contacting our team', 'general', 'hello hi help contact person human phone opening hours talk',
   'I can help with orders, returns, billing, technical problems and your account. Just type your question. If you would rather speak to a person, press Talk to a person and our team will reply here.'),
  ('Product questions', 'general', 'product question stock available size guide warranty item',
   'Every product page shows its size guide, stock level and warranty. If a product is out of stock, choose Notify me to get an email when it is back.'),
  ('Feedback and complaints', 'general', 'feedback complaint suggestion compliment review',
   'Thank you for your feedback. Every message is read by our team and helps us improve. If your feedback is about a specific order, please include the order number.')
) AS a(title, category, keywords, content)
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_documents d WHERE d.title = a.title);

-- ---------- 3. routing for account and general questions ----------
INSERT INTO public.routing_rules (name, intent, agent_id, action, priority, condition)
SELECT v.name, v.intent, v.agent_id::uuid, 'route_to_agent', v.priority, '{"max_risk": "medium", "min_confidence": 0.6}'::jsonb
FROM (VALUES ('Account Intent', 'account', '00000000-0000-0000-0000-000000000205', 60),
             ('General Questions', 'general', '00000000-0000-0000-0000-000000000201', 70)) AS v(name, intent, agent_id, priority)
WHERE NOT EXISTS (SELECT 1 FROM public.routing_rules r WHERE r.intent = v.intent);

-- ---------- 4. the core feature, now answering the actual question ----------
CREATE OR REPLACE FUNCTION public.submit_enquiry(p_message text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_customer_id uuid := private.my_customer_id();
  v_user_id     uuid := private.my_user_id();
  v_text        text := trim(COALESCE(p_message, ''));
  v_low         text;
  v_intent      text := 'unknown';
  v_hits        int  := 0;
  v_sentiment   text := 'neutral';
  v_urgency     text := 'medium';
  v_risk        text := 'low';
  v_conf        numeric(4,3);
  v_priority    text;
  v_injection   boolean;
  v_sensitive   boolean;
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
BEGIN
  -- Who is calling?
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Only signed-in customers can submit an enquiry' USING ERRCODE = '42501';
  END IF;
  -- Server-side validation (the app validates too)
  IF char_length(v_text) < 5 THEN
    RAISE EXCEPTION 'Please describe your issue in at least 5 characters' USING ERRCODE = '22023';
  ELSIF char_length(v_text) > 2000 THEN
    RAISE EXCEPTION 'Please keep your message under 2000 characters' USING ERRCODE = '22023';
  END IF;
  v_low := lower(v_text);

  -- ---------- classify (rule-based keywords) ----------
  v_injection := v_low ~ '(ignore (all |your |the )?(previous|prior) instructions|system prompt|reveal (your|the|internal)|act as (an? )?admin|jailbreak)';
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
  v_conf := CASE WHEN v_intent = 'unknown' THEN 0.400 WHEN v_hits >= 2 THEN 0.920 ELSE 0.780 END;

  IF v_low ~ '(furious|ridiculous|unacceptable|worst|disgusting|angry|scam|!!)' THEN v_sentiment := 'angry';
  ELSIF v_low ~ '(wrong|not working|cannot|can''t|didn''t|problem|issue|broken|still)' THEN v_sentiment := 'negative';
  ELSIF v_low ~ '(thanks|thank you|great|love|happy)' THEN v_sentiment := 'positive';
  END IF;

  IF v_low ~ '(urgent|asap|immediately|right now|emergency)' THEN v_urgency := 'critical';
  ELSIF v_sentiment IN ('angry','negative') THEN v_urgency := 'high';
  ELSIF v_intent = 'unknown' THEN v_urgency := 'low';
  END IF;

  v_sensitive := v_intent = 'refund_request'
              OR v_low ~ '(change my (bank|card|account)|delete my account|close my account|legal|lawyer)';
  v_risk := CASE WHEN v_injection THEN 'critical' WHEN v_sensitive THEN 'high'
                 WHEN v_sentiment = 'angry' THEN 'medium' ELSE 'low' END;
  v_priority := CASE WHEN v_risk IN ('critical','high') OR v_urgency = 'critical' THEN 'high'
                     WHEN v_urgency = 'high' THEN 'medium'
                     WHEN v_intent = 'unknown' THEN 'low' ELSE 'normal' END;

  SELECT (value #>> '{}')::numeric INTO v_threshold FROM public.platform_settings WHERE setting_key = 'confidence_threshold';
  v_threshold := COALESCE(v_threshold, 0.70);

  -- ---------- find the best approved help article for THIS question ----------
  -- Full-text search over title + keywords + content, so different questions
  -- get different answers. Articles in the question's topic get a small boost.
  v_cat := CASE WHEN v_intent IN ('order_status','return_request') THEN 'orders'
                WHEN v_intent IN ('billing_question','refund_request') THEN 'billing'
                WHEN v_intent = 'technical_issue' THEN 'technical'
                WHEN v_intent = 'account' THEN 'account' END;
  v_words := array_to_string(ARRAY(SELECT DISTINCT w FROM regexp_split_to_table(v_low, '[^a-z0-9]+') w WHERE length(w) >= 2), ' or ');
  IF v_words <> '' THEN
    v_query := websearch_to_tsquery('english', v_words);
    SELECT d.document_id, d.title, d.version, d.content INTO v_doc_id, v_doc_title, v_doc_version, v_doc_content
    FROM public.knowledge_documents d
    WHERE d.status = 'approved' AND d.search @@ v_query
    ORDER BY ts_rank(d.search, v_query) + CASE WHEN d.category = v_cat THEN 0.3 ELSE 0 END DESC, d.updated_at DESC
    LIMIT 1;
  END IF;

  -- No keyword topic, but a help article matched: take the topic from the article
  IF v_intent = 'unknown' AND v_doc_id IS NOT NULL THEN
    SELECT CASE category WHEN 'orders' THEN 'order_status' WHEN 'billing' THEN 'billing_question'
                         WHEN 'technical' THEN 'technical_issue' WHEN 'account' THEN 'account' ELSE 'general' END
    INTO v_intent FROM public.knowledge_documents WHERE document_id = v_doc_id;
    v_conf := 0.750;
    IF v_urgency = 'low' THEN v_urgency := 'medium'; END IF;
    v_priority := CASE WHEN v_priority = 'low' THEN 'normal' ELSE v_priority END;
  END IF;

  -- ---------- route (first matching active routing rule) ----------
  SELECT r.agent_id, a.name INTO v_agent_id, v_agent_name
  FROM public.routing_rules r JOIN public.ai_agents a ON a.agent_id = r.agent_id
  WHERE r.status = 'active' AND r.action = 'route_to_agent' AND r.intent = v_intent AND a.status = 'active'
  ORDER BY r.priority LIMIT 1;

  -- ---------- create case, conversation, customer message ----------
  SELECT resolution_minutes INTO v_sla_minutes FROM public.sla_policies WHERE priority = v_priority;
  INSERT INTO public.cases (customer_id, status, priority, intent, sentiment, urgency, risk, confidence,
                            subject, assigned_agent_id, sla_due_at)
  VALUES (v_customer_id, 'ai_handling', v_priority, v_intent, v_sentiment, v_urgency, v_risk, v_conf,
          left(v_text, 200), v_agent_id, now() + make_interval(mins => COALESCE(v_sla_minutes, 480)))
  RETURNING case_id, case_number INTO v_case_id, v_case_number;

  INSERT INTO public.conversations (case_id, channel) VALUES (v_case_id, 'web_chat') RETURNING conversation_id INTO v_conv_id;
  INSERT INTO public.messages (conversation_id, sender_type, sender_id, content)
  VALUES (v_conv_id, 'customer', v_user_id, v_text) RETURNING message_id INTO v_msg_id;

  INSERT INTO public.classifications (case_id, agent_id, intent, sentiment, urgency, risk, language, confidence)
  VALUES (v_case_id, '00000000-0000-0000-0000-000000000202', v_intent, v_sentiment, v_urgency, v_risk, 'en', v_conf);
  INSERT INTO public.audit_logs (actor, actor_type, action, entity_type, entity_id, case_id, result, risk_level, details)
  VALUES ('Intent Classifier', 'ai_agent', 'classified_intent', 'cases', v_case_id, v_case_id, 'success', v_risk,
          jsonb_build_object('intent', v_intent, 'confidence', v_conf, 'routed_to', v_agent_name));

  -- ---------- escalation rules: security rule first, then priority order; first match wins ----------
  FOR v_rule IN SELECT * FROM public.escalation_rules WHERE status = 'active'
                ORDER BY (condition_type = 'prompt_injection') DESC, priority LOOP
    IF (v_rule.condition_type = 'prompt_injection'        AND v_injection)
    OR (v_rule.condition_type = 'risk_equals'             AND v_risk = v_rule.threshold_value)
    OR (v_rule.condition_type = 'sensitive_action'        AND v_sensitive)
    OR (v_rule.condition_type = 'sentiment_equals'        AND v_sentiment = v_rule.threshold_value)
    OR (v_rule.condition_type = 'urgency_equals'          AND v_urgency = v_rule.threshold_value)
    OR (v_rule.condition_type = 'confidence_below'        AND v_conf < COALESCE(v_rule.threshold_value::numeric, v_threshold))
    OR (v_rule.condition_type = 'customer_requests_human' AND v_low ~ '(human|real person|speak to (an? )?(agent|someone))')
    OR (v_rule.condition_type = 'agent_cannot_answer'     AND (v_agent_id IS NULL OR v_doc_id IS NULL)) THEN
      v_esc_id := v_rule.rule_id;
      v_esc_name := v_rule.name;
      EXIT;
    END IF;
  END LOOP;

  IF v_esc_id IS NOT NULL THEN
    v_status := 'escalated';
    UPDATE public.cases SET status = 'escalated', assigned_agent_id = NULL WHERE case_id = v_case_id;
    INSERT INTO public.escalations (case_id, reason, escalated_from, escalated_to, rule_id)
    VALUES (v_case_id, v_esc_name, COALESCE(v_agent_name, 'Orchestrator'), 'human_support_queue', v_esc_id);

    IF v_injection THEN
      INSERT INTO public.security_events (event_type, case_id, message_id, severity, description, action_taken)
      VALUES ('prompt_injection', v_case_id, v_msg_id, 'high', left(v_text, 300), 'Blocked; case sent to human review');
      v_reply := 'For your security this request has been passed to our support team. A person will reply shortly.';
    ELSIF v_sensitive THEN
      v_reply := 'This request needs approval from a staff member, so I have passed it to our support team. Estimated wait: a few minutes.';
      INSERT INTO public.audit_logs (actor, actor_type, action, entity_type, entity_id, case_id, result, risk_level)
      VALUES ('Policy Engine', 'system', 'restricted_action_blocked', 'cases', v_case_id, v_case_id, 'blocked', 'high');
    ELSIF v_esc_name = 'Customer Asks Human' THEN
      v_reply := 'Of course. I have passed your request to a member of our support team, who will reply here shortly.';
    ELSIF v_doc_id IS NULL THEN
      v_reply := 'I could not find an approved answer for that, so I have passed it to a member of our support team. They will reply here shortly.';
    ELSE
      v_reply := 'I have passed your request to a member of our support team, who will reply shortly.';
    END IF;

    INSERT INTO public.messages (conversation_id, sender_type, sender_id, content, message_type)
    VALUES (v_conv_id, 'system', NULL, v_reply, 'escalation_notice');
    INSERT INTO public.audit_logs (actor, actor_type, action, entity_type, entity_id, case_id, result, risk_level, details)
    VALUES ('Orchestrator', 'ai_agent', 'case_escalated', 'cases', v_case_id, v_case_id, 'success', v_risk,
            jsonb_build_object('rule', v_esc_name));
    -- Tell every support agent and team leader
    INSERT INTO public.notifications (user_id, type, title, case_id)
    SELECT u.user_id, 'new_escalation', v_case_number || ': ' || v_esc_name, v_case_id
    FROM public.users u WHERE u.role IN ('support_agent','team_leader') AND u.status = 'active';
  ELSE
    -- ---------- reply from the approved article found above ----------
    IF v_doc_id IS NULL THEN
      v_reply := 'I could not find approved information for this, so I have passed it to our support team.';
    ELSE
      v_reply := v_doc_content;
    END IF;
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
    'intent', v_intent, 'sentiment', v_sentiment, 'urgency', v_urgency, 'risk', v_risk,
    'confidence', v_conf, 'routed_to', COALESCE(v_agent_name, 'Human Queue'),
    'escalation_rule', v_esc_name, 'reply', v_reply,
    'source', CASE WHEN v_doc_id IS NOT NULL AND v_status = 'ai_handling' THEN v_doc_title || ' ' || v_doc_version END);
END $$;
REVOKE EXECUTE ON FUNCTION public.submit_enquiry(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.submit_enquiry(text) TO authenticated;

COMMIT;

-- Check: approved articles per topic
SELECT category, count(*) AS approved_articles
FROM public.knowledge_documents WHERE status = 'approved' GROUP BY category ORDER BY category;
