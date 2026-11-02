-- =====================================================================
-- NexusCX AI - Migration 023: Northbridge staff positions and teams
-- Run AFTER 022_better_answers.sql, once, in the Supabase SQL Editor.
--
-- University staff get real job titles and university teams, so the demo
-- looks like a university (lecturer, librarian, reception...), not a shop:
--   * users.job_title: shown instead of the system role name when set
--   * Northbridge teams: Academic Services, Student Services, Student Centre,
--     Library, IT Service Desk, Admissions & Finance
--   * more Northbridge staff (logins are added in Supabase -> Authentication
--     -> Add user, with the same email and Auto Confirm)
--   * Team Operations shows only the organisation's own staff, with titles
-- =====================================================================
BEGIN;

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS job_title varchar(80);

-- Store staff keep their store titles
UPDATE public.users SET job_title = CASE role WHEN 'support_agent' THEN 'Customer Support Agent' WHEN 'team_leader' THEN 'Support Team Leader' END
WHERE industry = 'ecommerce' AND role IN ('support_agent', 'team_leader') AND job_title IS NULL;
UPDATE public.users SET job_title = 'Platform Administrator' WHERE role = 'administrator' AND job_title IS NULL;
UPDATE public.users SET job_title = 'Knowledge Manager (platform)' WHERE role = 'knowledge_manager' AND job_title IS NULL;

-- Northbridge teams
UPDATE public.teams SET name = 'Student Services', description = 'Northbridge: ID cards, careers, wellbeing, international students'
WHERE name = 'Northbridge Student Services';
INSERT INTO public.teams (name, description)
SELECT v.name, v.description FROM (VALUES
  ('Student Services',     'Northbridge: ID cards, careers, wellbeing, international students'),
  ('Academic Services',    'Northbridge: enrolment, exams, results, special consideration'),
  ('Student Centre',       'Northbridge: front desk and enquiries'),
  ('Library',              'Northbridge: library services and study spaces'),
  ('IT Service Desk',      'Northbridge: passwords, Wi-Fi, Moodle, email'),
  ('Admissions & Finance', 'Northbridge: applications, offers, fees and scholarships')
) AS v(name, description)
WHERE NOT EXISTS (SELECT 1 FROM public.teams t WHERE t.name = v.name);

-- Existing Northbridge demo staff: real positions
UPDATE public.users SET job_title = 'Senior Lecturer & Academic Adviser', team_id = (SELECT team_id FROM public.teams WHERE name = 'Academic Services')
WHERE lower(email) = 'chris.wong@example.test';
UPDATE public.users SET job_title = 'Student Services Officer', team_id = (SELECT team_id FROM public.teams WHERE name = 'Student Services')
WHERE lower(email) = 'ella.martin@example.test';

-- More Northbridge staff
INSERT INTO public.users (name, email, username, role, presence, industry, job_title, team_id)
SELECT v.name, v.email, v.username, 'support_agent', v.presence, 'university', v.title, (SELECT team_id FROM public.teams WHERE name = v.team)
FROM (VALUES
  ('Grace Kim',  'grace.kim@example.test',  'grace.kim',  'online',  'Librarian',                     'Library'),
  ('Tom Nguyen', 'tom.nguyen@example.test', 'tom.nguyen', 'online',  'Student Centre Receptionist',   'Student Centre'),
  ('Raj Mehta',  'raj.mehta@example.test',  'raj.mehta',  'away',    'IT Service Desk Officer',       'IT Service Desk'),
  ('Lucy Park',  'lucy.park@example.test',  'lucy.park',  'online',  'Admissions & Finance Officer',  'Admissions & Finance')
) AS v(name, email, username, presence, title, team)
WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE lower(u.email) = lower(v.email));

-- Team Operations: this organisation's staff only, with job titles
CREATE OR REPLACE FUNCTION public.team_stats(p_days int DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_days int := CASE WHEN p_days IN (7, 30, 90) THEN p_days ELSE 30 END;
  v_from timestamptz := date_trunc('day', now()) - (v_days - 1) * interval '1 day';
  v_ind  text := public.current_industry();
BEGIN
  IF NOT private.has_permission('view_analytics') THEN
    RAISE EXCEPTION 'You do not have permission to view team operations.' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'people', coalesce((SELECT jsonb_agg(x ORDER BY x.team NULLS LAST, x.name) FROM (
      SELECT u.user_id, u.name, u.role, u.job_title, t.name AS team, u.presence, u.max_active_cases, u.last_active_at,
        (SELECT count(*) FROM public.case_assignments a JOIN public.cases c USING (case_id)
          WHERE a.user_id = u.user_id AND a.status = 'active' AND c.status NOT IN ('resolved','closed') AND c.industry = v_ind) AS active_cases,
        (SELECT count(DISTINCT a.case_id) FROM public.case_assignments a JOIN public.cases c USING (case_id) WHERE a.user_id = u.user_id AND a.assigned_at >= v_from AND c.industry = v_ind) AS taken,
        (SELECT count(DISTINCT a.case_id) FROM public.case_assignments a JOIN public.cases c USING (case_id)
          WHERE a.user_id = u.user_id AND c.resolved_at >= v_from AND c.industry = v_ind) AS resolved,
        (SELECT round(avg(extract(epoch FROM a.assigned_at - e.created_at) / 60))::int
          FROM public.case_assignments a JOIN public.escalations e ON e.case_id = a.case_id
          WHERE a.user_id = u.user_id AND a.assigned_at >= v_from AND a.assigned_at > e.created_at) AS pickup_min,
        (SELECT round(avg(f.rating), 1) FROM public.feedback f JOIN public.case_assignments a ON a.case_id = f.case_id
          WHERE a.user_id = u.user_id AND f.created_at >= v_from) AS rating,
        (SELECT count(*) FROM public.messages m WHERE m.sender_id = u.user_id AND m.sender_type = 'human_agent' AND m.sent_at >= v_from) AS replies
      FROM public.users u LEFT JOIN public.teams t ON t.team_id = u.team_id
      WHERE u.status = 'active' AND (u.industry IS NULL OR u.industry = v_ind)   -- only this organisation's staff
        AND (u.role IN ('support_agent','team_leader')
            OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.user_id AND r.role IN ('support_agent','team_leader')))) x), '[]'),
    'queue', jsonb_build_object(
      'waiting', (SELECT count(*) FROM public.cases WHERE status = 'escalated' AND industry = v_ind),
      'oldest_wait_min', (SELECT round(extract(epoch FROM now() - min(e.created_at)) / 60)::int FROM public.escalations e
                          JOIN public.cases c USING (case_id) WHERE c.status = 'escalated' AND c.industry = v_ind),
      'sla_breached', (SELECT count(*) FROM public.cases WHERE status NOT IN ('resolved','closed') AND sla_due_at < now() AND industry = v_ind),
      'unassigned_high', (SELECT count(*) FROM public.cases c WHERE c.status = 'escalated' AND c.priority IN ('high','urgent') AND c.industry = v_ind))
  );
END $$;

COMMIT;
