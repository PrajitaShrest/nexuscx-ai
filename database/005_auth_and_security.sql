-- =====================================================================
-- NexusCX AI - Migration 005: login (Supabase Auth), roles and access rules
-- Run AFTER 004_prototype_alignment.sql, once, in the Supabase SQL Editor.
--
-- What it does
--   1. Links each Supabase Auth login (auth.users) to a row in public.users.
--      New sign-ups become customers. If the email already exists in
--      public.users (a seeded staff member), the login is linked to it.
--   2. Adds helper functions that answer "who is signed in, what is their
--      role, which permissions do they have" (private schema, not exposed).
--   3. For EVERY table: GRANT + ENABLE ROW LEVEL SECURITY + POLICIES.
--      Nothing is granted to anon (visitors who are not signed in).
--   4. Adds submit_enquiry(): the core feature. A signed-in customer sends
--      a message; the database classifies it, routes it, escalates it if
--      a rule matches, and replies from approved knowledge only.
-- =====================================================================
BEGIN;

-- ---------------------------------------------------------------------
-- 1. Link auth.users -> public.users
-- ---------------------------------------------------------------------
ALTER TABLE public.users
  ADD COLUMN auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated;

-- Runs when someone signs up (or an admin adds a user in the dashboard).
-- SECURITY DEFINER because the new user has no rights on public.users yet.
CREATE OR REPLACE FUNCTION private.handle_new_auth_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_name    text := COALESCE(NULLIF(trim(NEW.raw_user_meta_data ->> 'full_name'), ''), split_part(NEW.email, '@', 1));
  v_user_id uuid;
BEGIN
  -- Existing (seeded) person with the same email: link the login to them
  UPDATE public.users SET auth_user_id = NEW.id
  WHERE lower(email) = lower(NEW.email) AND auth_user_id IS NULL
  RETURNING user_id INTO v_user_id;

  IF v_user_id IS NULL THEN
    INSERT INTO public.users (user_id, name, email, role, auth_user_id, presence, last_active_at)
    VALUES (NEW.id, left(v_name, 100), NEW.email, 'customer', NEW.id, 'online', now())
    RETURNING user_id INTO v_user_id;
    INSERT INTO public.customers (user_id) VALUES (v_user_id);
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION private.handle_new_auth_user() FROM public, anon, authenticated;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private.handle_new_auth_user();

-- ---------------------------------------------------------------------
-- 2. Helper functions (who am I? what may I do?)
--    SECURITY DEFINER so they can read users/role_permissions without
--    being blocked by the very policies that call them.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.my_user_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT user_id FROM public.users WHERE auth_user_id = (SELECT auth.uid()) AND status = 'active'
$$;

CREATE OR REPLACE FUNCTION private.my_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT role FROM public.users WHERE auth_user_id = (SELECT auth.uid()) AND status = 'active'
$$;

CREATE OR REPLACE FUNCTION private.my_customer_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT c.customer_id FROM public.customers c JOIN public.users u ON u.user_id = c.user_id
  WHERE u.auth_user_id = (SELECT auth.uid()) AND u.status = 'active'
$$;

CREATE OR REPLACE FUNCTION private.has_permission(p_permission text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u JOIN public.role_permissions rp ON rp.role = u.role
    WHERE u.auth_user_id = (SELECT auth.uid()) AND u.status = 'active' AND rp.permission = p_permission)
$$;

-- Can the signed-in user see this case? (owner customer, or staff with view_cases)
CREATE OR REPLACE FUNCTION private.can_see_case(p_case_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT (SELECT private.has_permission('view_cases'))
      OR EXISTS (SELECT 1 FROM public.cases c
                 WHERE c.case_id = p_case_id AND c.customer_id = (SELECT private.my_customer_id()))
$$;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA private FROM public, anon;
GRANT EXECUTE ON FUNCTION private.my_user_id(), private.my_role(), private.my_customer_id(),
  private.has_permission(text), private.can_see_case(uuid) TO authenticated;

-- Users may not change their own role or status; only managers of users can.
CREATE OR REPLACE FUNCTION private.guard_user_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role OR NEW.status IS DISTINCT FROM OLD.status
      OR NEW.team_id IS DISTINCT FROM OLD.team_id OR NEW.email IS DISTINCT FROM OLD.email
      OR NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id)
     AND (SELECT auth.uid()) IS NOT NULL
     AND NOT private.has_permission('manage_users') THEN
    RAISE EXCEPTION 'Only administrators can change roles, teams or account status'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_users_guard BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION private.guard_user_changes();

-- ---------------------------------------------------------------------
-- 3. Start from zero: nobody can touch anything until granted below
-- ---------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- ---------- users ----------
GRANT SELECT ON public.users TO authenticated;
GRANT UPDATE (name, presence, last_active_at, role, status, team_id) ON public.users TO authenticated;
CREATE POLICY "Users read self; staff read everyone" ON public.users FOR SELECT TO authenticated
  USING (auth_user_id = (SELECT auth.uid()) OR (SELECT private.has_permission('view_cases')));
CREATE POLICY "Users update self" ON public.users FOR UPDATE TO authenticated
  USING (auth_user_id = (SELECT auth.uid())) WITH CHECK (auth_user_id = (SELECT auth.uid()));
CREATE POLICY "Admins update any user" ON public.users FOR UPDATE TO authenticated
  USING ((SELECT private.has_permission('manage_users'))) WITH CHECK ((SELECT private.has_permission('manage_users')));

-- ---------- customers ----------
GRANT SELECT ON public.customers TO authenticated;
GRANT UPDATE (phone, address) ON public.customers TO authenticated;
CREATE POLICY "Customers read own profile; staff read all" ON public.customers FOR SELECT TO authenticated
  USING (customer_id = (SELECT private.my_customer_id()) OR (SELECT private.has_permission('view_cases')));
CREATE POLICY "Customers update own profile" ON public.customers FOR UPDATE TO authenticated
  USING (customer_id = (SELECT private.my_customer_id())) WITH CHECK (customer_id = (SELECT private.my_customer_id()));

-- ---------- teams, role_permissions (reference data) ----------
GRANT SELECT ON public.teams, public.role_permissions TO authenticated;
CREATE POLICY "Signed-in users read teams" ON public.teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed-in users read role permissions" ON public.role_permissions FOR SELECT TO authenticated USING (true);

-- ---------- cases ----------
-- Customers create cases only through submit_enquiry(), never directly.
GRANT SELECT ON public.cases TO authenticated;
GRANT UPDATE (status, priority, assigned_agent_id, first_response_at, closed_at) ON public.cases TO authenticated;
CREATE POLICY "Customers read own cases; staff read all" ON public.cases FOR SELECT TO authenticated
  USING (customer_id = (SELECT private.my_customer_id()) OR (SELECT private.has_permission('view_cases')));
CREATE POLICY "Staff with resolve permission update cases" ON public.cases FOR UPDATE TO authenticated
  USING ((SELECT private.has_permission('resolve_cases'))) WITH CHECK ((SELECT private.has_permission('resolve_cases')));

-- ---------- conversations, messages ----------
GRANT SELECT ON public.conversations, public.messages TO authenticated;
GRANT INSERT (conversation_id, sender_type, sender_id, content) ON public.messages TO authenticated;
CREATE POLICY "Read conversations of visible cases" ON public.conversations FOR SELECT TO authenticated
  USING ((SELECT private.can_see_case(case_id)));
CREATE POLICY "Read messages of visible cases" ON public.messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.conversations cv WHERE cv.conversation_id = messages.conversation_id
                 AND (SELECT private.can_see_case(cv.case_id))));
CREATE POLICY "Customers write in own cases; agents write in any case" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = (SELECT private.my_user_id())
    AND EXISTS (SELECT 1 FROM public.conversations cv WHERE cv.conversation_id = messages.conversation_id
                AND (SELECT private.can_see_case(cv.case_id)))
    AND ((sender_type = 'customer' AND (SELECT private.my_role()) = 'customer')
      OR (sender_type = 'human_agent' AND (SELECT private.has_permission('resolve_cases')))));

-- ---------- classifications, escalations, citations, retrievals ----------
GRANT SELECT ON public.classifications, public.escalations, public.message_citations TO authenticated;
GRANT UPDATE (status) ON public.escalations TO authenticated;
CREATE POLICY "Read classifications of visible cases" ON public.classifications FOR SELECT TO authenticated
  USING ((SELECT private.can_see_case(case_id)));
CREATE POLICY "Read escalations of visible cases" ON public.escalations FOR SELECT TO authenticated
  USING ((SELECT private.can_see_case(case_id)));
CREATE POLICY "Staff update escalation status" ON public.escalations FOR UPDATE TO authenticated
  USING ((SELECT private.has_permission('resolve_cases'))) WITH CHECK ((SELECT private.has_permission('resolve_cases')));
CREATE POLICY "Read citations of visible messages" ON public.message_citations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.messages m JOIN public.conversations cv ON cv.conversation_id = m.conversation_id
                 WHERE m.message_id = message_citations.message_id AND (SELECT private.can_see_case(cv.case_id))));

GRANT SELECT ON public.knowledge_retrievals TO authenticated;
CREATE POLICY "Staff read retrieval log" ON public.knowledge_retrievals FOR SELECT TO authenticated
  USING ((SELECT private.has_permission('view_cases')));

-- ---------- case_assignments ----------
GRANT SELECT, INSERT (case_id, user_id), UPDATE (status) ON public.case_assignments TO authenticated;
CREATE POLICY "Staff read assignments" ON public.case_assignments FOR SELECT TO authenticated
  USING ((SELECT private.has_permission('view_cases')));
CREATE POLICY "Staff take cases themselves" ON public.case_assignments FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.has_permission('resolve_cases'))
              AND (user_id = (SELECT private.my_user_id()) OR (SELECT private.has_permission('manage_users'))));
CREATE POLICY "Staff update assignments" ON public.case_assignments FOR UPDATE TO authenticated
  USING ((SELECT private.has_permission('resolve_cases'))) WITH CHECK ((SELECT private.has_permission('resolve_cases')));

-- ---------- feedback ----------
GRANT SELECT, INSERT (case_id, rating, comment) ON public.feedback TO authenticated;
CREATE POLICY "Customers read own feedback; analysts read all" ON public.feedback FOR SELECT TO authenticated
  USING ((SELECT private.has_permission('view_analytics'))
         OR EXISTS (SELECT 1 FROM public.cases c WHERE c.case_id = feedback.case_id
                    AND c.customer_id = (SELECT private.my_customer_id())));
CREATE POLICY "Customers rate own resolved cases" ON public.feedback FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.cases c WHERE c.case_id = feedback.case_id
                      AND c.customer_id = (SELECT private.my_customer_id())
                      AND c.status IN ('resolved','closed')));

-- ---------- AI configuration (read by all signed-in users, changed by configure_ai) ----------
GRANT SELECT ON public.ai_agents, public.routing_rules, public.escalation_rules,
                public.agent_action_policies, public.sla_policies TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.routing_rules, public.escalation_rules,
                public.agent_action_policies, public.sla_policies TO authenticated;
GRANT UPDATE (status, health, confidence_threshold, description, system_instructions) ON public.ai_agents TO authenticated;

CREATE POLICY "Signed-in users read agents" ON public.ai_agents FOR SELECT TO authenticated USING (true);
CREATE POLICY "AI admins update agents" ON public.ai_agents FOR UPDATE TO authenticated
  USING ((SELECT private.has_permission('configure_ai'))) WITH CHECK ((SELECT private.has_permission('configure_ai')));

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['routing_rules','escalation_rules','agent_action_policies','sla_policies'] LOOP
    EXECUTE format('CREATE POLICY "Staff read %1$s" ON public.%1$I FOR SELECT TO authenticated
                    USING ((SELECT private.has_permission(''view_cases'')))', t);
    EXECUTE format('CREATE POLICY "AI admins insert %1$s" ON public.%1$I FOR INSERT TO authenticated
                    WITH CHECK ((SELECT private.has_permission(''configure_ai'')))', t);
    EXECUTE format('CREATE POLICY "AI admins update %1$s" ON public.%1$I FOR UPDATE TO authenticated
                    USING ((SELECT private.has_permission(''configure_ai''))) WITH CHECK ((SELECT private.has_permission(''configure_ai'')))', t);
    EXECUTE format('CREATE POLICY "AI admins delete %1$s" ON public.%1$I FOR DELETE TO authenticated
                    USING ((SELECT private.has_permission(''configure_ai'')))', t);
  END LOOP;
END $$;

-- ---------- knowledge base ----------
GRANT SELECT, INSERT (title, category, content, source, version, owner, status),
      UPDATE (title, category, content, source, version, owner, status, approved_by, approved_at)
      ON public.knowledge_documents TO authenticated;
CREATE POLICY "Everyone reads approved docs; knowledge managers read all" ON public.knowledge_documents FOR SELECT TO authenticated
  USING (status = 'approved' OR (SELECT private.has_permission('manage_knowledge')));
CREATE POLICY "Knowledge managers add docs" ON public.knowledge_documents FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.has_permission('manage_knowledge')) AND status IN ('draft','under_review'));
CREATE POLICY "Knowledge managers edit docs" ON public.knowledge_documents FOR UPDATE TO authenticated
  USING ((SELECT private.has_permission('manage_knowledge'))) WITH CHECK ((SELECT private.has_permission('manage_knowledge')));

-- ---------- Agent Builder ----------
GRANT SELECT, INSERT (agent_name, department, business_goal, requirements, description) ON public.agent_builder_requests TO authenticated;
GRANT UPDATE (status) ON public.agent_builder_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.agent_config_versions, public.agent_tests, public.agent_knowledge_sources TO authenticated;
ALTER TABLE public.agent_builder_requests ALTER COLUMN user_id SET DEFAULT private.my_user_id();
CREATE POLICY "Staff read own requests; AI admins read all" ON public.agent_builder_requests FOR SELECT TO authenticated
  USING (user_id = (SELECT private.my_user_id()) OR (SELECT private.has_permission('configure_ai')));
CREATE POLICY "Staff submit agent requests" ON public.agent_builder_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT private.my_user_id()) AND (SELECT private.my_role()) <> 'customer');
CREATE POLICY "AI admins update requests" ON public.agent_builder_requests FOR UPDATE TO authenticated
  USING ((SELECT private.has_permission('configure_ai'))) WITH CHECK ((SELECT private.has_permission('configure_ai')));
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['agent_config_versions','agent_tests','agent_knowledge_sources'] LOOP
    EXECUTE format('CREATE POLICY "AI admins manage %1$s" ON public.%1$I FOR ALL TO authenticated
                    USING ((SELECT private.has_permission(''configure_ai'')))
                    WITH CHECK ((SELECT private.has_permission(''configure_ai'')))', t);
  END LOOP;
END $$;

-- ---------- audit and security (read-only to auditors; written by the system) ----------
GRANT SELECT ON public.audit_logs, public.security_events TO authenticated;
CREATE POLICY "Auditors read audit log" ON public.audit_logs FOR SELECT TO authenticated
  USING ((SELECT private.has_permission('view_audit_logs')));
CREATE POLICY "Auditors read security events" ON public.security_events FOR SELECT TO authenticated
  USING ((SELECT private.has_permission('view_audit_logs')));

-- ---------- settings ----------
GRANT SELECT, UPDATE (value, updated_by) ON public.platform_settings TO authenticated;
CREATE POLICY "Staff read settings" ON public.platform_settings FOR SELECT TO authenticated
  USING ((SELECT private.my_role()) <> 'customer');
CREATE POLICY "AI admins change settings" ON public.platform_settings FOR UPDATE TO authenticated
  USING ((SELECT private.has_permission('configure_ai'))) WITH CHECK ((SELECT private.has_permission('configure_ai')));

-- ---------- notifications (each user sees only their own) ----------
GRANT SELECT, UPDATE (read_at) ON public.notifications TO authenticated;
CREATE POLICY "Users read own notifications" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = (SELECT private.my_user_id()));
CREATE POLICY "Users mark own notifications read" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = (SELECT private.my_user_id())) WITH CHECK (user_id = (SELECT private.my_user_id()));

-- ---------- views (security_invoker: the policies above still apply) ----------
GRANT SELECT ON public.v_case_queue, public.v_dashboard_kpis, public.v_agent_performance,
                public.v_team_workload TO authenticated;

-- =====================================================================
-- 4. Core feature: submit_enquiry()
--    A signed-in customer sends one message. In one transaction the
--    database: creates the case, conversation and message; classifies
--    the text (rule-based for Week 6, replaced by an LLM in Week 7);
--    routes it with routing_rules; checks escalation_rules; replies from
--    approved knowledge only; and writes the audit trail.
--    SECURITY DEFINER because classifications, escalations and audit
--    records must be written by the system, never by the customer.
--    The function checks who is calling before it does anything.
-- =====================================================================
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
    OR (v_rule.condition_type = 'agent_cannot_answer'     AND v_agent_id IS NULL) THEN
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
    -- ---------- reply from approved knowledge only ----------
    SELECT d.document_id, d.title, d.version, d.content INTO v_doc_id, v_doc_title, v_doc_version, v_doc_content
    FROM public.knowledge_documents d
    WHERE d.status = 'approved'
      AND d.category = CASE WHEN v_intent IN ('order_status','return_request') THEN 'orders'
                            WHEN v_intent IN ('billing_question','refund_request') THEN 'billing'
                            WHEN v_intent = 'technical_issue' THEN 'technical' ELSE 'general' END
    ORDER BY (CASE WHEN v_low ~ 'return' AND d.title ILIKE '%return%' THEN 0
                   WHEN v_low ~ '(password|log ?in)' AND d.title ILIKE '%password%' THEN 0 ELSE 1 END),
             d.updated_at DESC
    LIMIT 1;

    IF v_doc_id IS NULL THEN
      v_reply := 'I could not find approved information for this, so I have passed it to our support team.';
    ELSE
      v_reply := v_doc_content || ' (Source: ' || v_doc_title || ' ' || v_doc_version || ')';
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
    'source', CASE WHEN v_doc_id IS NOT NULL THEN v_doc_title || ' ' || v_doc_version END);
END $$;

REVOKE EXECUTE ON FUNCTION public.submit_enquiry(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.submit_enquiry(text) TO authenticated;

COMMIT;

-- Check: every public table should show rls_enabled = true
SELECT tablename, rowsecurity AS rls_enabled,
       (SELECT count(*) FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = t.tablename) AS policies
FROM pg_tables t WHERE schemaname = 'public' ORDER BY tablename;
