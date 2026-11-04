-- =====================================================================
-- NexusCX AI - Migration 028: AI credit checker (credit for previous study)
-- Run AFTER 027_ai_follow_ups.sql, in the Supabase SQL Editor.
-- Safe to run more than once.
--
-- A student enters (or pastes) the units from their previous transcript.
-- The AI Credit Assessor decides straight away, using rules kept here:
--   * a passed unit (grade P or better) from the last 10 years,
--   * that matches a Northbridge unit in the student's course, either by an
--     approved credit precedent (approved before for the same unit) or by
--     the same content (same key words in the unit name),
--   * up to half of the course,
-- is approved at once - no staff needed. Only units that partly match go to
-- an academic assessor, who only has to check those. Every decision is
-- logged, and the student gets a credit decision they can download.
-- =====================================================================
BEGIN;

-- ---------- the units of each Northbridge course ----------
CREATE TABLE IF NOT EXISTS public.northbridge_units (
  code   varchar(10) PRIMARY KEY,
  name   varchar(100) NOT NULL,
  course varchar(80) NOT NULL,
  year_level int NOT NULL
);
ALTER TABLE public.northbridge_units ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone signed in can read units" ON public.northbridge_units;
CREATE POLICY "Anyone signed in can read units" ON public.northbridge_units FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.northbridge_units TO authenticated;

INSERT INTO public.northbridge_units (code, name, course, year_level) VALUES
  ('NIT101', 'Introduction to Programming', 'Bachelor of Information Technology', 1),
  ('NIT102', 'Computer Systems', 'Bachelor of Information Technology', 1),
  ('NIT103', 'Web Fundamentals', 'Bachelor of Information Technology', 1),
  ('NIT104', 'Professional Communication in IT', 'Bachelor of Information Technology', 1),
  ('NIT111', 'Object-Oriented Programming', 'Bachelor of Information Technology', 2),
  ('NIT112', 'Database Systems', 'Bachelor of Information Technology', 2),
  ('NIT113', 'Networks and Communications', 'Bachelor of Information Technology', 2),
  ('NIT114', 'Discrete Mathematics', 'Bachelor of Information Technology', 2),
  ('NIT201', 'Data Structures and Algorithms', 'Bachelor of Information Technology', 3),
  ('NIT202', 'Systems Analysis and Design', 'Bachelor of Information Technology', 3),
  ('NIT203', 'Operating Systems', 'Bachelor of Information Technology', 3),
  ('NIT204', 'User Experience Design', 'Bachelor of Information Technology', 3),
  ('NIT211', 'Cyber Security Fundamentals', 'Bachelor of Information Technology', 4),
  ('NIT212', 'Cloud Computing', 'Bachelor of Information Technology', 4),
  ('NIT213', 'Mobile App Development', 'Bachelor of Information Technology', 4),
  ('NIT214', 'Software Testing', 'Bachelor of Information Technology', 4),
  ('NIT301', 'Artificial Intelligence', 'Bachelor of Information Technology', 5),
  ('NIT302', 'Project Management', 'Bachelor of Information Technology', 5),
  ('NIT303', 'IT Ethics and Law', 'Bachelor of Information Technology', 5),
  ('NIT304', 'Data Analytics', 'Bachelor of Information Technology', 5),
  ('NIT311', 'Capstone Project A', 'Bachelor of Information Technology', 6),
  ('NIT312', 'Capstone Project B', 'Bachelor of Information Technology', 6),
  ('NIT313', 'Machine Learning', 'Bachelor of Information Technology', 6),
  ('NIT314', 'Industry Placement', 'Bachelor of Information Technology', 6),
  ('NBS101', 'Principles of Management', 'Bachelor of Business', 1),
  ('NBS102', 'Accounting for Business', 'Bachelor of Business', 1),
  ('NBS103', 'Microeconomics', 'Bachelor of Business', 1),
  ('NBS104', 'Business Communication', 'Bachelor of Business', 1),
  ('NBS111', 'Marketing Principles', 'Bachelor of Business', 2),
  ('NBS112', 'Macroeconomics', 'Bachelor of Business', 2),
  ('NBS113', 'Business Statistics', 'Bachelor of Business', 2),
  ('NBS114', 'Business Law', 'Bachelor of Business', 2),
  ('NBS201', 'Organisational Behaviour', 'Bachelor of Business', 3),
  ('NBS202', 'Financial Management', 'Bachelor of Business', 3),
  ('NBS203', 'Consumer Behaviour', 'Bachelor of Business', 3),
  ('NBS204', 'Business Information Systems', 'Bachelor of Business', 3),
  ('NBS211', 'Human Resource Management', 'Bachelor of Business', 4),
  ('NBS212', 'Operations Management', 'Bachelor of Business', 4),
  ('NBS213', 'Digital Marketing', 'Bachelor of Business', 4),
  ('NBS214', 'Business Analytics', 'Bachelor of Business', 4),
  ('NBS301', 'Strategic Management', 'Bachelor of Business', 5),
  ('NBS302', 'International Business', 'Bachelor of Business', 5),
  ('NBS303', 'Entrepreneurship and Innovation', 'Bachelor of Business', 5),
  ('NBS304', 'Corporate Governance', 'Bachelor of Business', 5),
  ('NBS311', 'Business Capstone', 'Bachelor of Business', 6),
  ('NBS312', 'Leadership and Change', 'Bachelor of Business', 6),
  ('NBS313', 'Sustainability in Business', 'Bachelor of Business', 6),
  ('NBS314', 'Work-Integrated Learning', 'Bachelor of Business', 6),
  ('NNU101', 'Foundations of Nursing Practice', 'Bachelor of Nursing', 1),
  ('NNU102', 'Human Anatomy and Physiology 1', 'Bachelor of Nursing', 1),
  ('NNU103', 'Communication in Health Care', 'Bachelor of Nursing', 1),
  ('NNU104', 'Health and Wellbeing', 'Bachelor of Nursing', 1),
  ('NNU111', 'Human Anatomy and Physiology 2', 'Bachelor of Nursing', 2),
  ('NNU112', 'Clinical Skills 1', 'Bachelor of Nursing', 2),
  ('NNU113', 'Aboriginal and Torres Strait Islander Health', 'Bachelor of Nursing', 2),
  ('NNU114', 'Evidence-Based Practice', 'Bachelor of Nursing', 2),
  ('NNU201', 'Pharmacology for Nurses', 'Bachelor of Nursing', 3),
  ('NNU202', 'Medical-Surgical Nursing 1', 'Bachelor of Nursing', 3),
  ('NNU203', 'Mental Health Nursing', 'Bachelor of Nursing', 3),
  ('NNU204', 'Clinical Placement 1', 'Bachelor of Nursing', 3),
  ('NNU211', 'Medical-Surgical Nursing 2', 'Bachelor of Nursing', 4),
  ('NNU212', 'Maternal and Child Health', 'Bachelor of Nursing', 4),
  ('NNU213', 'Aged Care Nursing', 'Bachelor of Nursing', 4),
  ('NNU214', 'Clinical Placement 2', 'Bachelor of Nursing', 4),
  ('NNU301', 'Acute Care Nursing', 'Bachelor of Nursing', 5),
  ('NNU302', 'Community and Primary Health', 'Bachelor of Nursing', 5),
  ('NNU303', 'Ethics and Law in Nursing', 'Bachelor of Nursing', 5),
  ('NNU304', 'Clinical Placement 3', 'Bachelor of Nursing', 5),
  ('NNU311', 'Leadership in Nursing', 'Bachelor of Nursing', 6),
  ('NNU312', 'Complex Care', 'Bachelor of Nursing', 6),
  ('NNU313', 'Transition to Practice', 'Bachelor of Nursing', 6),
  ('NNU314', 'Clinical Placement 4', 'Bachelor of Nursing', 6),
  ('NDT101', 'Programming Basics', 'Diploma of Information Technology', 1),
  ('NDT102', 'IT Support Essentials', 'Diploma of Information Technology', 1),
  ('NDT103', 'Web Design', 'Diploma of Information Technology', 1),
  ('NDT104', 'Workplace Communication', 'Diploma of Information Technology', 1),
  ('NDT111', 'Database Basics', 'Diploma of Information Technology', 2),
  ('NDT112', 'Networking Basics', 'Diploma of Information Technology', 2),
  ('NDT113', 'Cyber Security Awareness', 'Diploma of Information Technology', 2),
  ('NDT114', 'IT Project', 'Diploma of Information Technology', 2),
  ('NMT501', 'Programming for IT Professionals', 'Master of Information Technology', 1),
  ('NMT502', 'Enterprise Databases', 'Master of Information Technology', 1),
  ('NMT503', 'Networking and Cloud', 'Master of Information Technology', 1),
  ('NMT504', 'IT Project Management', 'Master of Information Technology', 1),
  ('NMT511', 'Cyber Security Management', 'Master of Information Technology', 2),
  ('NMT512', 'Artificial Intelligence and Machine Learning', 'Master of Information Technology', 2),
  ('NMT513', 'Systems Architecture', 'Master of Information Technology', 2),
  ('NMT514', 'Research Methods in IT', 'Master of Information Technology', 2),
  ('NMT601', 'Data Science and Analytics', 'Master of Information Technology', 3),
  ('NMT602', 'IT Governance and Ethics', 'Master of Information Technology', 3),
  ('NMT603', 'Advanced Network Security', 'Master of Information Technology', 3),
  ('NMT604', 'IT Project Part A', 'Master of Information Technology', 3),
  ('NMT611', 'Post-Quantum Cryptography', 'Master of Information Technology', 4),
  ('NMT612', 'Digital Transformation', 'Master of Information Technology', 4),
  ('NMT613', 'IT Capstone Project', 'Master of Information Technology', 4),
  ('NMT614', 'IT Project Part B', 'Master of Information Technology', 4),
  ('NMB501', 'Leading People', 'Master of Business Administration', 1),
  ('NMB502', 'Accounting for Managers', 'Master of Business Administration', 1),
  ('NMB503', 'Managerial Economics', 'Master of Business Administration', 1),
  ('NMB504', 'Marketing Management', 'Master of Business Administration', 1),
  ('NMB511', 'Corporate Finance', 'Master of Business Administration', 2),
  ('NMB512', 'Operations and Supply Chain', 'Master of Business Administration', 2),
  ('NMB513', 'Business Analytics for Decisions', 'Master of Business Administration', 2),
  ('NMB514', 'Ethics and Sustainability', 'Master of Business Administration', 2),
  ('NMB601', 'Strategy', 'Master of Business Administration', 3),
  ('NMB602', 'Innovation and Entrepreneurship', 'Master of Business Administration', 3),
  ('NMB603', 'Negotiation', 'Master of Business Administration', 3),
  ('NMB604', 'Global Business', 'Master of Business Administration', 3),
  ('NMB611', 'Change Leadership', 'Master of Business Administration', 4),
  ('NMB612', 'Digital Business', 'Master of Business Administration', 4),
  ('NMB613', 'Consulting Project', 'Master of Business Administration', 4),
  ('NMB614', 'MBA Capstone', 'Master of Business Administration', 4)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, course = EXCLUDED.course, year_level = EXCLUDED.year_level;

-- ---------- credit precedents: units approved for credit before ----------
CREATE TABLE IF NOT EXISTS public.credit_precedents (
  precedent_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution  varchar(100),            -- NULL = any recognised Australian provider
  from_name    varchar(120) NOT NULL,   -- the unit name at the other provider
  to_code      varchar(10) NOT NULL REFERENCES public.northbridge_units(code),
  approved_on  date NOT NULL DEFAULT current_date,
  UNIQUE (institution, from_name, to_code)
);
ALTER TABLE public.credit_precedents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff read precedents" ON public.credit_precedents;
CREATE POLICY "Staff read precedents" ON public.credit_precedents FOR SELECT TO authenticated USING ((SELECT private.has_permission('view_cases')));
GRANT SELECT ON public.credit_precedents TO authenticated;

INSERT INTO public.credit_precedents (institution, from_name, to_code) VALUES
  (NULL, 'Programming Fundamentals', 'NIT101'), (NULL, 'Introduction to Coding', 'NIT101'),
  (NULL, 'Python Programming', 'NIT101'), (NULL, 'Java Programming', 'NIT111'),
  (NULL, 'Database Design', 'NIT112'), (NULL, 'Databases', 'NIT112'), (NULL, 'SQL and Databases', 'NIT112'),
  (NULL, 'Computer Networks', 'NIT113'), (NULL, 'Networking Essentials', 'NIT113'), (NULL, 'Cisco CCNA 1', 'NIT113'),
  (NULL, 'Web Development', 'NIT103'), (NULL, 'HTML and CSS', 'NIT103'),
  (NULL, 'Computer Hardware and Systems', 'NIT102'), (NULL, 'Information Security', 'NIT211'),
  (NULL, 'Introduction to Statistics', 'NBS113'), (NULL, 'Quantitative Methods', 'NBS113'),
  (NULL, 'Financial Accounting', 'NBS102'), (NULL, 'Introduction to Accounting', 'NBS102'),
  (NULL, 'Economics 1', 'NBS103'), (NULL, 'Management Principles', 'NBS101'), (NULL, 'Introduction to Marketing', 'NBS111'),
  (NULL, 'Workplace Communication', 'NBS104'), (NULL, 'Commercial Law', 'NBS114'),
  (NULL, 'Bioscience 1', 'NNU102'), (NULL, 'Anatomy and Physiology', 'NNU102'), (NULL, 'Bioscience 2', 'NNU111'),
  (NULL, 'Certificate IV Ageing Support', 'NNU213'),
  ('TAFE NSW', 'Diploma of Information Technology - Programming', 'NIT101'),
  ('TAFE NSW', 'Diploma of Information Technology - Networking', 'NIT113')
ON CONFLICT DO NOTHING;

-- ---------- matching ----------
-- Key words of a unit name: lower case, no plurals, common words dropped,
-- a few names that mean the same thing joined up.
CREATE OR REPLACE FUNCTION private.credit_words(p text) RETURNS text[]
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT COALESCE(array_agg(DISTINCT w2), '{}') FROM (
    SELECT CASE w WHEN 'coding' THEN 'programming' WHEN 'networking' THEN 'network' WHEN 'math' THEN 'mathematic'
                  WHEN 'stat' THEN 'statistic' WHEN 'website' THEN 'web' WHEN 'html' THEN 'web' WHEN 'sql' THEN 'database'
                  WHEN 'bioscience' THEN 'physiology' WHEN 'security' THEN 'security' WHEN 'cyber' THEN 'security'
                  ELSE w END AS w2
    FROM (SELECT regexp_replace(t, '(ies)$', 'y') AS t0, t FROM regexp_split_to_table(lower(regexp_replace(COALESCE(p, ''), '[^A-Za-z ]', ' ', 'g')), '\s+') t) a,
         LATERAL (SELECT CASE WHEN a.t0 <> a.t THEN a.t0 WHEN a.t ~ '[^s]s$' THEN left(a.t, -1) ELSE a.t END AS w) b
    WHERE w <> '' AND length(w) > 1
      AND w NOT IN ('and','of','for','in','the','to','an','with','on','ii','iii','introduction','intro','fundamental','basic',
                    'principle','foundation','advanced','unit','course','study','essential','applied','concept','topic','part')
  ) x
$$;

-- Decide credit for a list of previous units, for one Northbridge course. Changes nothing.
-- p_units: [{"name": "...", "code": "...", "grade": "D" or "78", "year": 2023}]
CREATE OR REPLACE FUNCTION public.check_credit(p_course text, p_institution text, p_units jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  u        jsonb;
  v_out    jsonb := '[]'::jsonb;
  v_used   text[] := '{}';
  v_total  int;
  v_cap    int;
  v_points int := 0;
  v_review int := 0;
  v_name   text;
  v_grade  text;
  v_year   int;
  v_pass   boolean;
  v_words  text[];
  v_best   record;
  v_prec   record;
  v_dec    text;
  v_reason text;
  v_code   text;
  v_nbname text;
  v_score  numeric;
BEGIN
  SELECT count(*) * 10 INTO v_total FROM public.northbridge_units WHERE course = p_course;
  IF v_total = 0 THEN RAISE EXCEPTION 'Please choose your Northbridge course.' USING ERRCODE = '22023'; END IF;
  IF jsonb_typeof(p_units) <> 'array' OR jsonb_array_length(p_units) = 0 THEN RAISE EXCEPTION 'Please add at least one unit you studied.' USING ERRCODE = '22023'; END IF;
  IF jsonb_array_length(p_units) > 40 THEN RAISE EXCEPTION 'Please add up to 40 units.' USING ERRCODE = '22023'; END IF;
  v_cap := v_total / 2;   -- credit can cover up to half of a course

  FOR u IN SELECT * FROM jsonb_array_elements(p_units) LOOP
    v_name := left(btrim(COALESCE(u->>'name', '')), 120);
    v_grade := upper(btrim(COALESCE(u->>'grade', '')));
    v_year := CASE WHEN COALESCE(u->>'year', '') ~ '^\d{4}$' THEN (u->>'year')::int END;
    v_code := NULL; v_nbname := NULL; v_score := 0;
    IF length(v_name) < 3 THEN CONTINUE; END IF;
    v_pass := v_grade IN ('HD','D','C','P','CR','DN','PASS','CREDIT','DISTINCTION','HIGH DISTINCTION','S','SATISFACTORY','COMPETENT','CA')
              OR (v_grade ~ '^\d{1,3}$' AND v_grade::int BETWEEN 50 AND 100);

    IF NOT v_pass THEN
      v_dec := 'none'; v_reason := 'Not passed (' || COALESCE(NULLIF(v_grade, ''), 'no grade') || '). Only passed units can count for credit.';
    ELSIF v_year IS NULL OR v_year > extract(year FROM current_date)::int THEN
      v_dec := 'none'; v_reason := 'Please add the year you finished this unit.';
    ELSIF v_year < extract(year FROM current_date)::int - 10 THEN
      v_dec := 'none'; v_reason := 'Finished in ' || v_year || '. Credit is only given for study in the last 10 years.';
    ELSE
      -- 1. an approved precedent for this unit
      SELECT p.to_code, n.name INTO v_prec FROM public.credit_precedents p
      JOIN public.northbridge_units n ON n.code = p.to_code AND n.course = p_course
      WHERE lower(p.from_name) = lower(v_name) AND (p.institution IS NULL OR lower(p.institution) = lower(COALESCE(p_institution, '')))
        AND NOT (p.to_code = ANY (v_used))
      ORDER BY p.institution NULLS LAST LIMIT 1;
      IF FOUND THEN
        v_code := v_prec.to_code; v_nbname := v_prec.name; v_score := 1;
        v_dec := 'granted'; v_reason := 'Approved before for the same unit (credit precedent).';
      ELSE
        -- 2. the closest Northbridge unit by key words
        v_words := private.credit_words(v_name);
        SELECT n.code, n.name,
               (SELECT count(*) FROM unnest(v_words) x WHERE x = ANY (private.credit_words(n.name)))::numeric
                 / NULLIF((SELECT count(DISTINCT y) FROM unnest(v_words || private.credit_words(n.name)) y), 0) AS score
        INTO v_best
        FROM public.northbridge_units n
        WHERE n.course = p_course AND NOT (n.code = ANY (v_used))
        ORDER BY 3 DESC NULLS LAST, n.year_level, n.code LIMIT 1;
        v_score := COALESCE(v_best.score, 0);
        IF v_score >= 0.6 THEN
          v_code := v_best.code; v_nbname := v_best.name;
          v_dec := 'granted'; v_reason := 'Same content as ' || v_best.code || ' ' || v_best.name || '.';
        ELSIF v_score >= 0.3 THEN
          v_code := v_best.code; v_nbname := v_best.name;
          v_dec := 'review'; v_reason := 'Partly matches ' || v_best.code || ' ' || v_best.name || '. An academic assessor will compare the unit outlines.';
        ELSE
          v_dec := 'none'; v_reason := 'No unit in your course covers the same content.';
        END IF;
      END IF;
      IF v_dec IN ('granted', 'review') AND (v_points + v_review * 10 + 10) > v_cap THEN
        v_dec := 'none'; v_reason := 'You have reached the most credit allowed (half of the course).';
        v_code := NULL; v_nbname := NULL;
      END IF;
    END IF;

    IF v_dec = 'granted' THEN v_points := v_points + 10; v_used := v_used || v_code; END IF;
    IF v_dec = 'review' THEN v_review := v_review + 1; v_used := v_used || v_code; END IF;
    v_out := v_out || jsonb_build_object('name', v_name, 'code', left(COALESCE(u->>'code', ''), 12), 'grade', v_grade, 'year', v_year,
                                         'decision', v_dec, 'reason', v_reason, 'nb_code', v_code, 'nb_name', v_nbname, 'score', round(v_score, 2));
  END LOOP;

  RETURN jsonb_build_object('course', p_course, 'units', v_out, 'granted_points', v_points, 'granted_units', v_points / 10,
                            'review_units', v_review, 'total_points', v_total, 'cap_points', v_cap);
END $$;
REVOKE EXECUTE ON FUNCTION public.check_credit(text, text, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.check_credit(text, text, jsonb) TO authenticated;

-- ---------- the request type, and supporting documents ----------
INSERT INTO public.request_types (type_key, industry, title, summary, team_name, icon, keywords, fields, sla_hours, fee_note, sort) VALUES
('credit_transfer', 'university', 'Credit for previous study',
 'Get credit for units you already passed at another university or TAFE. Most decisions are instant.',
 'Academic Services', 'document',
 'credit (for|transfer)|advanced standing|recogni[sz]ed? prior|\brpl\b|previous (study|studies|uni|university|course)|(units?|subjects?) i (already )?(did|studied|completed|passed)',
 '[]', 48, 'Applying for credit is free.', 5)
ON CONFLICT (type_key) DO UPDATE SET title = EXCLUDED.title, summary = EXCLUDED.summary, team_name = EXCLUDED.team_name,
  icon = EXCLUDED.icon, keywords = EXCLUDED.keywords, sla_hours = EXCLUDED.sla_hours, fee_note = EXCLUDED.fee_note, sort = EXCLUDED.sort;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('request-documents', 'request-documents', false, 10485760, ARRAY['application/pdf','image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
DROP POLICY IF EXISTS "People upload own request documents" ON storage.objects;
CREATE POLICY "People upload own request documents" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'request-documents' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
DROP POLICY IF EXISTS "Owners and staff see request documents" ON storage.objects;
CREATE POLICY "Owners and staff see request documents" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'request-documents'
         AND ((storage.foldername(name))[1] = (SELECT auth.uid())::text OR (SELECT private.has_permission('view_cases'))));

-- ---------- apply: the AI decides, and only unclear units go to a person ----------
CREATE OR REPLACE FUNCTION public.apply_for_credit(p_course text, p_intake text, p_load text, p_institution text,
  p_qualification text, p_units jsonb, p_document text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_cust  uuid := private.require_customer();
  v_user  uuid := private.my_user_id();
  v_res   jsonb;
  v_req   uuid;
  v_num   text;
  v_open  text;
  v_status text;
  v_inst  text := left(btrim(COALESCE(p_institution, '')), 100);
  v_qual  text := left(btrim(COALESCE(p_qualification, '')), 100);
BEGIN
  IF public.current_industry() <> 'university' THEN RAISE EXCEPTION 'This form is not available.' USING ERRCODE = '22023'; END IF;
  IF length(v_inst) < 2 THEN RAISE EXCEPTION 'Please enter where you studied before.' USING ERRCODE = '22023'; END IF;
  IF p_intake NOT IN ('February 2024','July 2024','February 2025','July 2025','February 2026','July 2026') OR p_load NOT IN ('Full-time','Part-time') THEN
    RAISE EXCEPTION 'Please choose when you started and your study load.' USING ERRCODE = '22023';
  END IF;
  SELECT request_number INTO v_open FROM public.service_requests
  WHERE customer_id = v_cust AND type_key = 'credit_transfer' AND status IN ('submitted', 'in_review', 'needs_info') LIMIT 1;
  IF v_open IS NOT NULL THEN RAISE EXCEPTION 'You already have a credit application being checked (%).', v_open USING ERRCODE = '22023'; END IF;
  IF p_document IS NOT NULL AND p_document <> '' AND (p_document !~ ('^' || (SELECT auth.uid())::text || '/[A-Za-z0-9-]+\.(pdf|jpg|jpeg|png|webp)$')
       OR NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'request-documents' AND o.name = p_document)) THEN
    RAISE EXCEPTION 'Your transcript file did not upload correctly. Please add it again.' USING ERRCODE = '22023';
  END IF;

  v_res := public.check_credit(p_course, v_inst, p_units);
  v_status := CASE WHEN (v_res->>'review_units')::int > 0 THEN 'in_review' ELSE 'completed' END;

  INSERT INTO public.service_requests (type_key, customer_id, industry, status, details, photo_path, outcome, due_at, completed_at, ready_at)
  VALUES ('credit_transfer', v_cust, 'university', v_status,
          jsonb_build_object('course', p_course, 'intake', p_intake, 'load', p_load, 'institution', v_inst, 'qualification', v_qual,
                             'student_number', (SELECT student_number FROM public.customers WHERE customer_id = v_cust)),
          NULLIF(p_document, ''),
          v_res || jsonb_build_object('assessed', current_date, 'assessed_by', 'AI Credit Assessor'),
          now() + interval '48 hours',
          CASE WHEN v_status = 'completed' THEN now() END, CASE WHEN v_status = 'completed' THEN now() END)
  RETURNING request_id, request_number INTO v_req, v_num;

  INSERT INTO public.service_request_events (request_id, status, note, actor_name, actor_type) VALUES
    (v_req, 'submitted', 'Application sent with ' || jsonb_array_length(v_res->'units') || ' previous units.', (SELECT name FROM public.users WHERE user_id = v_user), 'person'),
    (v_req, v_status, (v_res->>'granted_units') || ' unit(s) approved by the credit rules'
       || CASE WHEN v_status = 'in_review' THEN '; ' || (v_res->>'review_units') || ' sent to an academic assessor.' ELSE '. Decision complete.' END,
     'AI Credit Assessor', 'system');
  INSERT INTO public.audit_logs (actor, actor_type, action, entity_type, entity_id, result, risk_level, details)
  VALUES ('AI Credit Assessor', 'ai_agent', 'credit_assessed', 'service_requests', v_req, 'success', 'low',
          jsonb_build_object('request', v_num, 'granted_units', v_res->'granted_units', 'review_units', v_res->'review_units', 'institution', v_inst));
  INSERT INTO public.notifications (user_id, type, title, link)
  VALUES (v_user, 'request_update', left(v_num || ': your credit decision is ready', 120), '/account/requests/' || v_req);
  IF v_status = 'in_review' THEN
    PERFORM private.notify_request_team(v_req, v_num || ': ' || (v_res->>'review_units') || ' credit unit(s) to check');
  END IF;
  RETURN jsonb_build_object('request_id', v_req, 'request_number', v_num, 'status', v_status);
END $$;
REVOKE EXECUTE ON FUNCTION public.apply_for_credit(text, text, text, text, text, jsonb, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.apply_for_credit(text, text, text, text, text, jsonb, text) TO authenticated;

-- ---------- the help article now points to the checker ----------
UPDATE public.knowledge_documents SET content =
  'You can check your credit (advanced standing) straight away with the Credit for previous study checker in Requests & forms: add the units you passed before, and the AI shows which Northbridge units you can skip. '
  || 'Passed units from the last 10 years that match a unit in your course are approved instantly. Units that only partly match are checked by an academic assessor. Credit can cover up to half of your course.',
  updated_at = now()
WHERE title = 'Credit for previous study' AND industry = 'university';

COMMIT;
