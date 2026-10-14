-- =====================================================================
-- 015  AI Agents, Routing & Escalation, Settings, Analytics, Team Ops, Audit
--      (Week 8)   Run after 014.
--
-- The AI pipeline (submit_enquiry, migration 009) already reads:
--   ai_agents.status, routing_rules, escalation_rules,
--   platform_settings.confidence_threshold and sla_policies.
-- These functions let an administrator (configure_ai) change them safely:
--   * every change is checked here, not only in the browser
--   * safety switches cannot be turned off
--   * every change is written to audit_logs with the before and after values
-- Read-only report functions check view_analytics themselves.
-- =====================================================================

CREATE OR REPLACE FUNCTION private.require_config() RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.has_permission('configure_ai') THEN
    RAISE EXCEPTION 'You do not have permission to change AI settings.' USING ERRCODE = '42501';
  END IF;
  RETURN private.my_user_id();
END $$;

CREATE OR REPLACE FUNCTION private.log_config(p_user uuid, p_action text, p_entity text, p_id uuid, p_risk text, p_details jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO public.audit_logs (user_id, actor, actor_type, action, entity_type, entity_id, result, risk_level, details)
  SELECT p_user, u.name, 'human', p_action, p_entity, p_id, 'success', p_risk, p_details
  FROM public.users u WHERE u.user_id = p_user
$$;

-- ---------- AI agents ----------
-- status: active (in use) or testing (paused: routing skips it and cases go to people)
CREATE OR REPLACE FUNCTION public.update_ai_agent(p_agent uuid, p_status text, p_instructions text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := private.require_config();
  v_a    public.ai_agents;
BEGIN
  SELECT * INTO v_a FROM public.ai_agents WHERE agent_id = p_agent FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That agent no longer exists.' USING ERRCODE = '22023'; END IF;
  IF p_status NOT IN ('active','testing') THEN
    RAISE EXCEPTION 'An agent can be active or paused.' USING ERRCODE = '22023';
  END IF;
  IF p_status <> 'active' AND v_a.type IN ('orchestrator','classifier','safety','policy') THEN
    RAISE EXCEPTION '% is a core agent and cannot be paused. Every message passes through it.', v_a.name USING ERRCODE = '22023';
  END IF;
  IF length(coalesce(p_instructions, '')) > 4000 THEN
    RAISE EXCEPTION 'Instructions can be up to 4000 characters.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.ai_agents SET status = p_status, system_instructions = NULLIF(btrim(p_instructions), ''), updated_at = now()
  WHERE agent_id = p_agent;
  PERFORM private.log_config(v_user, CASE WHEN p_status <> v_a.status THEN 'agent_' || CASE p_status WHEN 'active' THEN 'resumed' ELSE 'paused' END ELSE 'agent_updated' END,
    'ai_agents', p_agent, CASE WHEN p_status <> v_a.status THEN 'high' ELSE 'medium' END,
    jsonb_build_object('agent', v_a.name, 'before', jsonb_build_object('status', v_a.status), 'after', jsonb_build_object('status', p_status),
                       'instructions_changed', coalesce(v_a.system_instructions, '') IS DISTINCT FROM coalesce(btrim(p_instructions), '')));
END $$;

-- ---------- escalation rules ----------
CREATE OR REPLACE FUNCTION public.update_escalation_rule(
  p_rule uuid, p_status text, p_threshold text, p_severity text, p_action text, p_priority int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := private.require_config();
  v_r    public.escalation_rules;
  v_t    text := NULLIF(btrim(coalesce(p_threshold, '')), '');
BEGIN
  SELECT * INTO v_r FROM public.escalation_rules WHERE rule_id = p_rule FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That rule no longer exists.' USING ERRCODE = '22023'; END IF;
  IF p_status NOT IN ('active','inactive') OR p_severity NOT IN ('low','medium','high')
     OR p_action NOT IN ('escalate_to_human','block_and_escalate','human_queue') THEN
    RAISE EXCEPTION 'Please choose a valid status, severity and action.' USING ERRCODE = '22023';
  END IF;
  IF p_priority IS NULL OR p_priority < 1 OR p_priority > 99 THEN
    RAISE EXCEPTION 'Order must be a number from 1 to 99.' USING ERRCODE = '22023';
  END IF;
  IF p_status = 'inactive' AND v_r.condition_type IN ('prompt_injection','sensitive_action') THEN
    RAISE EXCEPTION 'The "%" rule protects customers and cannot be switched off.', v_r.name USING ERRCODE = '22023';
  END IF;
  IF v_r.condition_type = 'prompt_injection' AND p_action <> 'block_and_escalate' THEN
    RAISE EXCEPTION 'Prompt injection must always be blocked.' USING ERRCODE = '22023';
  END IF;

  -- the threshold must make sense for the kind of rule
  IF v_r.condition_type = 'confidence_below' THEN
    IF v_t IS NULL OR v_t !~ '^0?\.\d{1,2}$' OR v_t::numeric < 0.3 OR v_t::numeric > 0.95 THEN
      RAISE EXCEPTION 'Confidence must be between 0.30 and 0.95.' USING ERRCODE = '22023';
    END IF;
  ELSIF v_r.condition_type = 'sentiment_equals' AND coalesce(v_t, '') NOT IN ('angry','negative') THEN
    RAISE EXCEPTION 'Sentiment must be angry or negative.' USING ERRCODE = '22023';
  ELSIF v_r.condition_type IN ('urgency_equals','risk_equals') AND coalesce(v_t, '') NOT IN ('medium','high','critical') THEN
    RAISE EXCEPTION 'Level must be medium, high or critical.' USING ERRCODE = '22023';
  ELSIF v_r.condition_type IN ('sensitive_action','prompt_injection','agent_cannot_answer','customer_requests_human') THEN
    v_t := NULL;   -- these rules have no threshold
  END IF;

  UPDATE public.escalation_rules SET status = p_status, threshold_value = v_t, severity = p_severity, action = p_action, priority = p_priority
  WHERE rule_id = p_rule;
  PERFORM private.log_config(v_user, 'escalation_rule_changed', 'escalation_rules', p_rule,
    CASE WHEN p_status <> v_r.status THEN 'high' ELSE 'medium' END,
    jsonb_build_object('rule', v_r.name,
      'before', jsonb_build_object('status', v_r.status, 'threshold', v_r.threshold_value, 'severity', v_r.severity, 'action', v_r.action, 'priority', v_r.priority),
      'after',  jsonb_build_object('status', p_status, 'threshold', v_t, 'severity', p_severity, 'action', p_action, 'priority', p_priority)));
END $$;

-- ---------- routing rules ----------
CREATE OR REPLACE FUNCTION public.update_routing_rule(p_rule uuid, p_agent uuid, p_status text, p_priority int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := private.require_config();
  v_r    public.routing_rules;
  v_old  text; v_new text;
BEGIN
  SELECT * INTO v_r FROM public.routing_rules WHERE rule_id = p_rule FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That rule no longer exists.' USING ERRCODE = '22023'; END IF;
  IF p_status NOT IN ('active','inactive') THEN RAISE EXCEPTION 'Please choose active or off.' USING ERRCODE = '22023'; END IF;
  IF p_priority IS NULL OR p_priority < 1 OR p_priority > 99 THEN
    RAISE EXCEPTION 'Order must be a number from 1 to 99.' USING ERRCODE = '22023';
  END IF;
  IF v_r.action = 'route_to_agent' THEN
    IF NOT EXISTS (SELECT 1 FROM public.ai_agents WHERE agent_id = p_agent AND type IN ('specialist','orchestrator')) THEN
      RAISE EXCEPTION 'Choose an AI agent that answers customers.' USING ERRCODE = '22023';
    END IF;
  ELSE
    p_agent := NULL;
  END IF;
  SELECT name INTO v_old FROM public.ai_agents WHERE agent_id = v_r.agent_id;
  SELECT name INTO v_new FROM public.ai_agents WHERE agent_id = p_agent;

  UPDATE public.routing_rules SET agent_id = p_agent, status = p_status, priority = p_priority WHERE rule_id = p_rule;
  PERFORM private.log_config(v_user, 'routing_rule_changed', 'routing_rules', p_rule, 'medium',
    jsonb_build_object('rule', v_r.name, 'intent', v_r.intent,
      'before', jsonb_build_object('agent', v_old, 'status', v_r.status, 'priority', v_r.priority),
      'after',  jsonb_build_object('agent', v_new, 'status', p_status, 'priority', p_priority)));
END $$;

-- ---------- platform settings ----------
-- Safety switches are locked on. Two switches are kept in step with their escalation rules.
CREATE OR REPLACE FUNCTION public.update_setting(p_key text, p_value jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := private.require_config();
  v_s    public.platform_settings;
BEGIN
  SELECT * INTO v_s FROM public.platform_settings WHERE setting_key = p_key FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown setting.' USING ERRCODE = '22023'; END IF;
  IF jsonb_typeof(p_value) <> jsonb_typeof(v_s.value) THEN
    RAISE EXCEPTION 'That value is the wrong type for this setting.' USING ERRCODE = '22023';
  END IF;
  IF v_s.category = 'ai_safety' AND p_value = 'false'::jsonb THEN
    RAISE EXCEPTION 'Safety protections are always on.' USING ERRCODE = '22023';
  END IF;
  IF p_key = 'knowledge_approval_required' AND p_value = 'false'::jsonb THEN
    RAISE EXCEPTION 'The AI may only use approved articles. This cannot be switched off.' USING ERRCODE = '22023';
  END IF;
  IF p_key = 'confidence_threshold' AND ((p_value #>> '{}')::numeric < 0.3 OR (p_value #>> '{}')::numeric > 0.95) THEN
    RAISE EXCEPTION 'Confidence must be between 0.30 and 0.95.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_value) = 'string' AND (length(p_value #>> '{}') = 0 OR length(p_value #>> '{}') > 60) THEN
    RAISE EXCEPTION 'Text settings must be 1 to 60 characters.' USING ERRCODE = '22023';
  END IF;
  IF p_key = 'timezone' AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = p_value #>> '{}') THEN
    RAISE EXCEPTION 'Unknown time zone.' USING ERRCODE = '22023';
  END IF;
  IF p_key LIKE 'integration_%' AND (p_value #>> '{}') NOT IN ('connected','disconnected') THEN
    RAISE EXCEPTION 'Integrations are connected or disconnected.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.platform_settings SET value = p_value, updated_by = v_user, updated_at = now() WHERE setting_key = p_key;
  IF p_key = 'auto_escalate_angry' THEN
    UPDATE public.escalation_rules SET status = CASE WHEN p_value = 'true'::jsonb THEN 'active' ELSE 'inactive' END WHERE condition_type = 'sentiment_equals';
  ELSIF p_key = 'auto_escalate_high_risk' THEN
    UPDATE public.escalation_rules SET status = CASE WHEN p_value = 'true'::jsonb THEN 'active' ELSE 'inactive' END WHERE condition_type = 'risk_equals';
  ELSIF p_key = 'confidence_threshold' THEN
    UPDATE public.escalation_rules SET threshold_value = to_char((p_value #>> '{}')::numeric, 'FM0.00') WHERE condition_type = 'confidence_below';
  END IF;
  PERFORM private.log_config(v_user, 'setting_changed', 'platform_settings', NULL, 'medium',
    jsonb_build_object('setting', p_key, 'before', v_s.value, 'after', p_value));
END $$;

-- keep the settings page honest if someone changes the rule directly
CREATE OR REPLACE FUNCTION private.sync_rule_settings() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.condition_type = 'sentiment_equals' THEN
    UPDATE public.platform_settings SET value = to_jsonb(NEW.status = 'active') WHERE setting_key = 'auto_escalate_angry' AND value <> to_jsonb(NEW.status = 'active');
  ELSIF NEW.condition_type = 'risk_equals' THEN
    UPDATE public.platform_settings SET value = to_jsonb(NEW.status = 'active') WHERE setting_key = 'auto_escalate_high_risk' AND value <> to_jsonb(NEW.status = 'active');
  ELSIF NEW.condition_type = 'confidence_below' AND NEW.threshold_value ~ '^0?\.\d+$' THEN
    UPDATE public.platform_settings SET value = to_jsonb(NEW.threshold_value::numeric) WHERE setting_key = 'confidence_threshold' AND value <> to_jsonb(NEW.threshold_value::numeric);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_rule_settings ON public.escalation_rules;
CREATE TRIGGER trg_rule_settings AFTER UPDATE OF status, threshold_value ON public.escalation_rules
FOR EACH ROW EXECUTE FUNCTION private.sync_rule_settings();

-- ---------- SLA targets ----------
CREATE OR REPLACE FUNCTION public.update_sla_policy(p_priority text, p_first int, p_resolution int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := private.require_config();
  v_p    public.sla_policies;
BEGIN
  SELECT * INTO v_p FROM public.sla_policies WHERE priority = p_priority FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown priority.' USING ERRCODE = '22023'; END IF;
  IF p_first IS NULL OR p_first < 1 OR p_first > 1440 THEN
    RAISE EXCEPTION 'First response must be 1 to 1440 minutes.' USING ERRCODE = '22023';
  END IF;
  IF p_resolution IS NULL OR p_resolution < p_first OR p_resolution > 20160 THEN
    RAISE EXCEPTION 'Resolution must be at least the first-response time and at most 14 days.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.sla_policies SET first_response_minutes = p_first, resolution_minutes = p_resolution WHERE priority = p_priority;
  PERFORM private.log_config(v_user, 'sla_changed', 'sla_policies', NULL, 'medium',
    jsonb_build_object('priority', p_priority, 'before', jsonb_build_object('first', v_p.first_response_minutes, 'resolution', v_p.resolution_minutes),
                       'after', jsonb_build_object('first', p_first, 'resolution', p_resolution)));
END $$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['update_ai_agent(uuid,text,text)','update_escalation_rule(uuid,text,text,text,text,integer)',
    'update_routing_rule(uuid,uuid,text,integer)','update_setting(text,jsonb)','update_sla_policy(text,integer,integer)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM public, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;

-- ---------- Analytics (extra breakdowns beside case_stats) ----------
CREATE OR REPLACE FUNCTION public.analytics_breakdowns(p_days int DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_days int := CASE WHEN p_days IN (7, 30, 90) THEN p_days ELSE 30 END;
  v_from timestamptz := date_trunc('day', now()) - (v_days - 1) * interval '1 day';
  v_tz   text := coalesce((SELECT value #>> '{}' FROM public.platform_settings WHERE setting_key = 'timezone'), 'Australia/Sydney');
BEGIN
  IF NOT private.has_permission('view_analytics') THEN
    RAISE EXCEPTION 'You do not have permission to view analytics.' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'escalation_reasons', coalesce((SELECT jsonb_agg(x ORDER BY x.n DESC) FROM (
        SELECT coalesce(r.name, 'Other') AS reason, count(*) AS n
        FROM public.escalations e LEFT JOIN public.escalation_rules r ON r.rule_id = e.rule_id
        WHERE e.created_at >= v_from GROUP BY 1) x), '[]'),
    'ratings', (SELECT jsonb_object_agg(s, (SELECT count(*) FROM public.feedback f WHERE f.rating = s AND f.created_at >= v_from))
                FROM generate_series(1, 5) s),
    'hours', (SELECT jsonb_agg((SELECT count(*) FROM public.cases c WHERE c.created_at >= v_from
                 AND extract(hour FROM c.created_at AT TIME ZONE v_tz) = h) ORDER BY h) FROM generate_series(0, 23) h),
    'weekdays', (SELECT jsonb_agg((SELECT count(*) FROM public.cases c WHERE c.created_at >= v_from
                 AND extract(isodow FROM c.created_at AT TIME ZONE v_tz) = d) ORDER BY d) FROM generate_series(1, 7) d),
    'top_articles', coalesce((SELECT jsonb_agg(x ORDER BY x.n DESC) FROM (
        SELECT d.title, count(*) AS n FROM public.knowledge_retrievals k JOIN public.knowledge_documents d USING (document_id)
        WHERE k.retrieved_at >= v_from GROUP BY d.title ORDER BY count(*) DESC LIMIT 8) x), '[]'),
    'agents', coalesce((SELECT jsonb_agg(x ORDER BY x.requests DESC) FROM (
        SELECT a.name, a.department, a.status, count(c.case_id) AS requests,
               count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.escalations e WHERE e.case_id = c.case_id) AND c.case_id IS NOT NULL) AS ai_only,
               count(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.escalations e WHERE e.case_id = c.case_id)) AS escalated,
               round(100 * avg(c.confidence))::int AS confidence
        FROM public.ai_agents a LEFT JOIN public.cases c ON c.assigned_agent_id = a.agent_id AND c.created_at >= v_from
        WHERE a.type IN ('specialist','orchestrator') GROUP BY a.agent_id, a.name, a.department, a.status) x), '[]'),
    'security', coalesce((SELECT jsonb_object_agg(event_type, n) FROM (
        SELECT event_type, count(*) AS n FROM public.security_events WHERE created_at >= v_from GROUP BY 1) x), '{}')
  );
END $$;

-- ---------- Team operations ----------
CREATE OR REPLACE FUNCTION public.team_stats(p_days int DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_days int := CASE WHEN p_days IN (7, 30, 90) THEN p_days ELSE 30 END;
  v_from timestamptz := date_trunc('day', now()) - (v_days - 1) * interval '1 day';
BEGIN
  IF NOT private.has_permission('view_analytics') THEN
    RAISE EXCEPTION 'You do not have permission to view team operations.' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'people', coalesce((SELECT jsonb_agg(x ORDER BY x.team NULLS LAST, x.name) FROM (
      SELECT u.user_id, u.name, u.role, t.name AS team, u.presence, u.max_active_cases, u.last_active_at,
        (SELECT count(*) FROM public.case_assignments a JOIN public.cases c USING (case_id)
          WHERE a.user_id = u.user_id AND a.status = 'active' AND c.status NOT IN ('resolved','closed')) AS active_cases,
        (SELECT count(DISTINCT a.case_id) FROM public.case_assignments a WHERE a.user_id = u.user_id AND a.assigned_at >= v_from) AS taken,
        (SELECT count(DISTINCT a.case_id) FROM public.case_assignments a JOIN public.cases c USING (case_id)
          WHERE a.user_id = u.user_id AND c.resolved_at >= v_from) AS resolved,
        (SELECT round(avg(extract(epoch FROM a.assigned_at - e.created_at) / 60))::int
          FROM public.case_assignments a JOIN public.escalations e ON e.case_id = a.case_id
          WHERE a.user_id = u.user_id AND a.assigned_at >= v_from AND a.assigned_at > e.created_at) AS pickup_min,
        (SELECT round(avg(f.rating), 1) FROM public.feedback f JOIN public.case_assignments a ON a.case_id = f.case_id
          WHERE a.user_id = u.user_id AND f.created_at >= v_from) AS rating,
        (SELECT count(*) FROM public.messages m WHERE m.sender_id = u.user_id AND m.sender_type = 'human_agent' AND m.sent_at >= v_from) AS replies
      FROM public.users u LEFT JOIN public.teams t ON t.team_id = u.team_id
      WHERE u.status = 'active' AND (u.role IN ('support_agent','team_leader')
            OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.user_id AND r.role IN ('support_agent','team_leader')))) x), '[]'),
    'queue', jsonb_build_object(
      'waiting', (SELECT count(*) FROM public.cases WHERE status = 'escalated'),
      'oldest_wait_min', (SELECT round(extract(epoch FROM now() - min(e.created_at)) / 60)::int FROM public.escalations e
                          JOIN public.cases c USING (case_id) WHERE c.status = 'escalated'),
      'sla_breached', (SELECT count(*) FROM public.cases WHERE status NOT IN ('resolved','closed') AND sla_due_at < now()),
      'unassigned_high', (SELECT count(*) FROM public.cases c WHERE c.status = 'escalated' AND c.priority IN ('high','urgent')))
  );
END $$;

GRANT EXECUTE ON FUNCTION public.analytics_breakdowns(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.team_stats(int) TO authenticated;
REVOKE ALL ON FUNCTION public.analytics_breakdowns(int) FROM anon;
REVOKE ALL ON FUNCTION public.team_stats(int) FROM anon;

CREATE INDEX IF NOT EXISTS idx_audit_created ON public.audit_logs(created_at DESC);
