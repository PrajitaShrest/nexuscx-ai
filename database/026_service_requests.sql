-- =====================================================================
-- NexusCX AI - Migration 026: forms and service requests
-- Run AFTER 025_ai_order_changes.sql, in the Supabase SQL Editor.
-- Safe to run more than once.
--
-- Some questions are really requests: "I need a student ID card",
-- "I need an enrolment letter", "change my delivery address".
-- Instead of a chat back and forth, the AI offers the right FORM:
--   * filled in from the person's profile (name, student number, ...)
--   * checked as they type, and checked again here in the database
--   * with a photo upload where needed (ID card)
-- The request goes to the right team's queue. Staff check it, then mark
-- it ready; the person is told, and gets the result: a digital ID card,
-- a letter, a permit, or the changed order. Every step is logged.
--
-- Request types are DATA (public.request_types): a new form is one row,
-- not new code. Included:
--   University: Student ID card, Enrolment letter, Academic transcript,
--               Parking permit
--   Store:      Change delivery address (before the order ships)
-- =====================================================================
BEGIN;

-- ---------- student numbers (shown on ID cards and letters) ----------
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS student_number varchar(12);
CREATE UNIQUE INDEX IF NOT EXISTS customers_student_number_key ON public.customers (student_number);
CREATE SEQUENCE IF NOT EXISTS public.student_number_seq START 2610001;

CREATE OR REPLACE FUNCTION private.set_student_number() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.student_number IS NULL
     AND (SELECT industry FROM public.users WHERE user_id = NEW.user_id) = 'university' THEN
    NEW.student_number := 'N' || nextval('public.student_number_seq');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_student_number ON public.customers;
CREATE TRIGGER trg_student_number BEFORE INSERT ON public.customers
FOR EACH ROW EXECUTE FUNCTION private.set_student_number();

UPDATE public.customers c SET student_number = 'N' || nextval('public.student_number_seq')
FROM public.users u
WHERE u.user_id = c.user_id AND u.industry = 'university' AND c.student_number IS NULL;

-- ---------- request types: one row per form ----------
CREATE TABLE IF NOT EXISTS public.request_types (
  type_key    varchar(40) PRIMARY KEY,
  industry    varchar(20) NOT NULL CHECK (industry IN ('ecommerce', 'university')),
  title       varchar(80) NOT NULL,
  summary     varchar(200) NOT NULL,
  team_name   varchar(80) NOT NULL,          -- the team whose queue it lands in
  icon        varchar(20) NOT NULL DEFAULT 'form',
  keywords    text NOT NULL,                 -- a JavaScript pattern: chat messages that match it are offered this form
  fields      jsonb NOT NULL,                -- the form: see the rows below
  sla_hours   int NOT NULL DEFAULT 24,
  fee_note    varchar(300),
  sort        int NOT NULL DEFAULT 0,
  active      boolean NOT NULL DEFAULT true
);
ALTER TABLE public.request_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Request types of my organisation" ON public.request_types;
CREATE POLICY "Request types of my organisation" ON public.request_types FOR SELECT TO authenticated
  USING (active AND industry = (SELECT public.current_industry()));
GRANT SELECT ON public.request_types TO authenticated;

-- Field keys: name, label, type (text|textarea|date|select|checkbox|photo), required, help,
-- prefill (name|email|phone|date_of_birth|student_number), readonly, max, pattern + pattern_msg,
-- upper (make capitals), options (select), options_from ("open_orders"), rule (past|today_or_future),
-- show_if {"field": "...", "in": ["..."]}
INSERT INTO public.request_types (type_key, industry, title, summary, team_name, icon, keywords, fields, sla_hours, fee_note, sort) VALUES
('id_card', 'university', 'Student ID card',
 'A new or replacement student ID card. Get a digital card straight away when it is ready, and collect a physical card if you want one.',
 'Student Centre', 'idcard',
 '\b(id|student|uni|university) ?ca?e?rd|\bcard\b.*\b(lost|stolen|broken|damaged|new|replace)|\b(lost|stolen|broken|damaged|replace)\b.*\bcard\b',
 '[
   {"name":"full_name","label":"Full name (as it should appear on the card)","type":"text","required":true,"prefill":"name","max":40,
    "pattern":"^[A-Za-z][A-Za-z ''.-]{1,39}$","pattern_msg":"Use letters, spaces, hyphens and apostrophes only (2 to 40 characters)."},
   {"name":"student_number","label":"Student number","type":"text","required":true,"prefill":"student_number","readonly":true},
   {"name":"date_of_birth","label":"Date of birth","type":"date","required":true,"prefill":"date_of_birth","rule":"past"},
   {"name":"course","label":"Course","type":"select","required":true,"options":["Bachelor of Information Technology","Bachelor of Business","Bachelor of Nursing","Diploma of Information Technology","Master of Information Technology","Master of Business Administration"]},
   {"name":"reason","label":"Why do you need a card?","type":"select","required":true,"options":["My first student card","Lost or stolen card","Damaged card","Name change"]},
   {"name":"photo","label":"Your photo","type":"photo","required":true,
    "help":"A recent photo of your face only: looking straight at the camera, plain light background, no hat or sunglasses."},
   {"name":"delivery","label":"How would you like your card?","type":"select","required":true,"options":["Digital card only","Digital card + collect a physical card"]},
   {"name":"confirm","label":"I confirm these details are correct and the photo is of me","type":"checkbox","required":true}
 ]', 24, 'Your first card is free. A replacement for a lost, stolen or damaged card costs $25, paid when you collect it.', 1),

('enrolment_letter', 'university', 'Enrolment letter',
 'An official letter confirming you are enrolled, for a visa, bank, employer, Centrelink or rental application.',
 'Student Centre', 'letter',
 'enrol?ment (letter|proof|confirmation|certificate)|proof of (enrol?ment|study)|letter (for|to) (my )?(bank|visa|employer|centrelink|landlord)|statement of enrol?ment',
 '[
   {"name":"full_name","label":"Full name","type":"text","required":true,"prefill":"name","readonly":true},
   {"name":"student_number","label":"Student number","type":"text","required":true,"prefill":"student_number","readonly":true},
   {"name":"course","label":"Course","type":"select","required":true,"options":["Bachelor of Information Technology","Bachelor of Business","Bachelor of Nursing","Diploma of Information Technology","Master of Information Technology","Master of Business Administration"]},
   {"name":"intake","label":"When did you start this course?","type":"select","required":true,"options":["February 2024","July 2024","February 2025","July 2025","February 2026","July 2026"]},
   {"name":"load","label":"Study load","type":"select","required":true,"options":["Full-time","Part-time"]},
   {"name":"purpose","label":"What is the letter for?","type":"select","required":true,"options":["Student visa or immigration","Bank account","Centrelink","Employer","Rental application","Travel concession","Other"]},
   {"name":"addressed_to","label":"Addressed to (optional)","type":"text","required":false,"max":100,"help":"For example: Commonwealth Bank, Parramatta branch. Leave blank for \"To whom it may concern\"."},
   {"name":"include","label":"What should it include?","type":"select","required":true,"options":["Course and study dates","Course, study dates and fees"]},
   {"name":"delivery","label":"How would you like it?","type":"select","required":true,"options":["Digital letter (PDF)","Digital letter + printed copy to collect"]},
   {"name":"confirm","label":"I confirm these details are correct","type":"checkbox","required":true}
 ]', 24, 'Enrolment letters are free.', 2),

('transcript', 'university', 'Academic transcript',
 'A record of your units and results: an unofficial digital copy, or an official signed and sealed copy.',
 'Academic Services', 'document',
 'transcript|academic record|(copy|record) of (my )?(results|grades|marks)',
 '[
   {"name":"full_name","label":"Full name","type":"text","required":true,"prefill":"name","readonly":true},
   {"name":"student_number","label":"Student number","type":"text","required":true,"prefill":"student_number","readonly":true},
   {"name":"course","label":"Course","type":"select","required":true,"options":["Bachelor of Information Technology","Bachelor of Business","Bachelor of Nursing","Diploma of Information Technology","Master of Information Technology","Master of Business Administration"]},
   {"name":"intake","label":"When did you start this course?","type":"select","required":true,"options":["February 2024","July 2024","February 2025","July 2025","February 2026","July 2026"]},
   {"name":"load","label":"Study load","type":"select","required":true,"options":["Full-time","Part-time"]},
   {"name":"kind","label":"Which transcript?","type":"select","required":true,"options":["Unofficial (digital)","Official (signed and sealed)"]},
   {"name":"copies","label":"Number of official copies","type":"select","required":true,"options":["1","2","3"],"show_if":{"field":"kind","in":["Official (signed and sealed)"]}},
   {"name":"delivery","label":"How would you like it?","type":"select","required":true,"options":["Email me a PDF","Collect from the Student Centre","Post to me"]},
   {"name":"postal_address","label":"Postal address","type":"textarea","required":true,"max":200,"show_if":{"field":"delivery","in":["Post to me"]},"help":"Street, suburb, state and postcode."},
   {"name":"purpose","label":"What is it for?","type":"select","required":true,"options":["Further study","Job application","Professional registration","Personal records","Other"]},
   {"name":"confirm","label":"I confirm these details are correct","type":"checkbox","required":true}
 ]', 48, 'Unofficial transcripts are free. Official copies cost $20 each, paid when you collect them or before they are posted.', 3),

('parking_permit', 'university', 'Parking permit',
 'A student parking permit for the main campus car park: semester, full year or a single day.',
 'Student Centre', 'car',
 'park(ing)? (permit|pass|sticker)|permit to park|where (can|do) i park|car ?park',
 '[
   {"name":"full_name","label":"Full name","type":"text","required":true,"prefill":"name","readonly":true},
   {"name":"student_number","label":"Student number","type":"text","required":true,"prefill":"student_number","readonly":true},
   {"name":"rego","label":"Car registration (number plate)","type":"text","required":true,"upper":true,"pattern":"^[A-Z0-9]{2,7}$","pattern_msg":"Use 2 to 7 letters or numbers, with no spaces."},
   {"name":"rego_state","label":"State the car is registered in","type":"select","required":true,"options":["NSW","ACT","VIC","QLD","SA","WA","TAS","NT"]},
   {"name":"car","label":"Car make, model and colour","type":"text","required":true,"max":50,"help":"For example: Toyota Corolla, white."},
   {"name":"permit","label":"Permit","type":"select","required":true,"options":["Semester permit ($150)","Full year permit ($280)","Casual 1-day permit ($8)"]},
   {"name":"start_date","label":"Start date","type":"date","required":true,"rule":"today_or_future"},
   {"name":"phone","label":"Mobile number (in case your car needs moving)","type":"text","required":true,"prefill":"phone","pattern":"^04[0-9]{8}$","pattern_msg":"Use an Australian mobile number, like 0412345678."},
   {"name":"confirm","label":"I agree to follow the campus parking rules","type":"checkbox","required":true}
 ]', 24, 'Pay when the permit is ready. The permit is digital: your number plate is your permit.', 4),

('delivery_address', 'ecommerce', 'Change delivery address',
 'Change where an order is delivered, before it leaves our warehouse.',
 'Order Team', 'truck',
 '\b(change|update|wrong|new|different|correct)\b.*\b(delivery|shipping|postal|home|street) address|\b(delivery|shipping) address\b.*\b(change|update|wrong)|deliver (it |my order )?to (a )?(different|new|another)',
 '[
   {"name":"order","label":"Which order?","type":"select","required":true,"options_from":"open_orders"},
   {"name":"recipient","label":"Name of the person receiving it","type":"text","required":true,"prefill":"name","max":60},
   {"name":"line1","label":"Street address","type":"text","required":true,"max":100,"help":"For example: 12 Harbour St"},
   {"name":"line2","label":"Unit, level or building (optional)","type":"text","required":false,"max":60},
   {"name":"suburb","label":"Suburb","type":"text","required":true,"max":40,"pattern":"^[A-Za-z][A-Za-z ''.-]{1,39}$","pattern_msg":"Use letters only, like Parramatta."},
   {"name":"state","label":"State","type":"select","required":true,"options":["NSW","ACT","VIC","QLD","SA","WA","TAS","NT"]},
   {"name":"postcode","label":"Postcode","type":"text","required":true,"pattern":"^[0-9]{4}$","pattern_msg":"Use the 4-digit postcode."},
   {"name":"instructions","label":"Delivery instructions (optional)","type":"textarea","required":false,"max":200,"help":"For example: leave at the front door."},
   {"name":"confirm","label":"I confirm the new address is correct","type":"checkbox","required":true}
 ]', 4, 'Free while the order has not shipped.', 1)
ON CONFLICT (type_key) DO UPDATE SET industry = EXCLUDED.industry, title = EXCLUDED.title, summary = EXCLUDED.summary,
  team_name = EXCLUDED.team_name, icon = EXCLUDED.icon, keywords = EXCLUDED.keywords, fields = EXCLUDED.fields,
  sla_hours = EXCLUDED.sla_hours, fee_note = EXCLUDED.fee_note, sort = EXCLUDED.sort;

-- ---------- requests and their history ----------
CREATE SEQUENCE IF NOT EXISTS public.service_request_seq START 1001;
CREATE TABLE IF NOT EXISTS public.service_requests (
  request_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number varchar(12) NOT NULL UNIQUE DEFAULT ('SR-' || nextval('public.service_request_seq')),
  type_key       varchar(40) NOT NULL REFERENCES public.request_types(type_key),
  customer_id    uuid NOT NULL REFERENCES public.customers(customer_id) ON DELETE CASCADE,
  industry       varchar(20) NOT NULL CHECK (industry IN ('ecommerce', 'university')),
  status         varchar(20) NOT NULL DEFAULT 'submitted'
                 CHECK (status IN ('submitted', 'in_review', 'needs_info', 'ready', 'completed', 'rejected', 'cancelled')),
  details        jsonb NOT NULL,
  photo_path     text,
  order_id       uuid REFERENCES public.orders(order_id) ON DELETE SET NULL,
  assigned_to    uuid REFERENCES public.users(user_id) ON DELETE SET NULL,
  staff_note     varchar(500),
  outcome        jsonb NOT NULL DEFAULT '{}'::jsonb,
  due_at         timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  ready_at       timestamptz,
  completed_at   timestamptz
);
CREATE INDEX IF NOT EXISTS idx_service_requests_customer ON public.service_requests (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_requests_queue ON public.service_requests (industry, status, created_at);

CREATE TABLE IF NOT EXISTS public.service_request_events (
  event_id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.service_requests(request_id) ON DELETE CASCADE,
  status     varchar(20) NOT NULL,
  note       varchar(500),
  actor_name varchar(100),
  actor_type varchar(10) NOT NULL CHECK (actor_type IN ('person', 'staff', 'system')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.service_request_events ALTER COLUMN created_at SET DEFAULT clock_timestamp();
CREATE INDEX IF NOT EXISTS idx_service_request_events ON public.service_request_events (request_id, created_at);

ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_request_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own requests; staff of the same organisation" ON public.service_requests;
CREATE POLICY "Own requests; staff of the same organisation" ON public.service_requests FOR SELECT TO authenticated
  USING (customer_id = (SELECT private.my_customer_id())
         OR ((SELECT private.has_permission('view_cases')) AND industry = (SELECT public.current_industry())));
DROP POLICY IF EXISTS "History of requests I can see" ON public.service_request_events;
CREATE POLICY "History of requests I can see" ON public.service_request_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.service_requests r WHERE r.request_id = service_request_events.request_id));
GRANT SELECT ON public.service_requests, public.service_request_events TO authenticated;
-- No INSERT/UPDATE grants: every change goes through the functions below.

-- ---------- notifications: two new kinds ----------
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'new_escalation','sla_breach','low_confidence','case_assigned','agent_approval','customer_reply','staff_reply',
  'case_update','order_update','return_request','return_update','new_request','request_update'));

-- ---------- photos: private bucket, own folder ----------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('request-photos', 'request-photos', false, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
DROP POLICY IF EXISTS "People upload own request photos" ON storage.objects;
CREATE POLICY "People upload own request photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'request-photos' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
DROP POLICY IF EXISTS "Owners and staff see request photos" ON storage.objects;
CREATE POLICY "Owners and staff see request photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'request-photos'
         AND ((storage.foldername(name))[1] = (SELECT auth.uid())::text OR (SELECT private.has_permission('view_cases'))));

-- ---------- what the form is filled in with ----------
CREATE OR REPLACE FUNCTION private.request_prefill(p_cust uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'name', u.name, 'email', u.email,
    'phone', CASE WHEN c.phone ~ '^\+614[0-9]{8}$' THEN '0' || substr(c.phone, 4) ELSE c.phone END,
    'date_of_birth', c.date_of_birth, 'student_number', c.student_number,
    'open_orders', COALESCE((SELECT jsonb_agg(jsonb_build_object('value', o.order_number,
                      'label', o.order_number || ' · ' || (SELECT string_agg(i.product_name, ', ') FROM public.order_items i WHERE i.order_id = o.order_id)
                               || ' · to ' || o.ship_address) ORDER BY o.created_at DESC)
                    FROM public.orders o WHERE o.customer_id = c.customer_id AND o.status IN ('placed', 'processing')), '[]'::jsonb))
  FROM public.customers c JOIN public.users u ON u.user_id = c.user_id
  WHERE c.customer_id = p_cust
$$;

-- The signed-in person's forms, each with its pre-filled values
CREATE OR REPLACE FUNCTION public.my_request_forms() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_cust uuid := private.my_customer_id();
BEGIN
  IF v_cust IS NULL THEN RETURN jsonb_build_object('types', '[]'::jsonb, 'prefill', '{}'::jsonb); END IF;
  RETURN jsonb_build_object(
    'types', COALESCE((SELECT jsonb_agg(jsonb_build_object('type_key', t.type_key, 'title', t.title, 'summary', t.summary,
               'team_name', t.team_name, 'icon', t.icon, 'keywords', t.keywords, 'fields', t.fields, 'sla_hours', t.sla_hours,
               'fee_note', t.fee_note) ORDER BY t.sort)
             FROM public.request_types t WHERE t.active AND t.industry = public.current_industry()), '[]'::jsonb),
    'prefill', private.request_prefill(v_cust));
END $$;
GRANT EXECUTE ON FUNCTION public.my_request_forms() TO authenticated;

-- ---------- the same checks as the form, in the database ----------
-- Returns {"ok":true,"details":{...cleaned}} or {"ok":false,"field":"...","message":"..."}
CREATE OR REPLACE FUNCTION private.check_request_details(p_fields jsonb, p_details jsonb, p_prefill jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE
  f       jsonb;
  v_name  text;
  v       text;
  v_out   jsonb := '{}'::jsonb;
  v_cond  jsonb;
  v_date  date;
  v_opts  jsonb;
BEGIN
  FOR f IN SELECT * FROM jsonb_array_elements(p_fields) LOOP
    v_name := f->>'name';
    IF f->>'type' = 'photo' THEN CONTINUE; END IF;
    -- a field shown only for some answers
    v_cond := f->'show_if';
    IF v_cond IS NOT NULL AND NOT COALESCE((v_out->>(v_cond->>'field')) IN (SELECT jsonb_array_elements_text(v_cond->'in')), false) THEN
      CONTINUE;
    END IF;
    -- read-only fields always take the real value (it cannot be changed from the browser)
    IF COALESCE((f->>'readonly')::boolean, false) THEN
      v := p_prefill->>(f->>'prefill');
    ELSE
      v := btrim(COALESCE(p_details->>v_name, ''));
    END IF;
    IF COALESCE((f->>'upper')::boolean, false) THEN v := upper(replace(v, ' ', '')); END IF;

    IF f->>'type' = 'checkbox' THEN
      IF COALESCE((f->>'required')::boolean, false) AND v NOT IN ('true', 'on', 'yes') THEN
        RETURN jsonb_build_object('ok', false, 'field', v_name, 'message', 'Please tick: ' || rtrim(f->>'label', '?.') || '.');
      END IF;
      v_out := v_out || jsonb_build_object(v_name, v IN ('true', 'on', 'yes'));
      CONTINUE;
    END IF;

    IF v IS NULL OR v = '' THEN
      IF COALESCE((f->>'required')::boolean, false) THEN
        RETURN jsonb_build_object('ok', false, 'field', v_name, 'message', 'Please fill in: ' || rtrim(f->>'label', '?.') || '.');
      END IF;
      CONTINUE;
    END IF;
    IF length(v) > COALESCE((f->>'max')::int, 200) THEN
      RETURN jsonb_build_object('ok', false, 'field', v_name, 'message', (f->>'label') || ' is too long.');
    END IF;
    IF f->>'type' = 'select' THEN
      v_opts := CASE WHEN f ? 'options_from' THEN (SELECT jsonb_agg(o->'value') FROM jsonb_array_elements(p_prefill->(f->>'options_from')) o)
                     ELSE f->'options' END;
      IF v_opts IS NULL OR NOT (v_opts ? v) THEN
        RETURN jsonb_build_object('ok', false, 'field', v_name, 'message', 'Please choose one of the options for: ' || rtrim(f->>'label', '?.') || '.');
      END IF;
    END IF;
    IF f->>'type' = 'date' THEN
      BEGIN
        v_date := v::date;
      EXCEPTION WHEN others THEN
        RETURN jsonb_build_object('ok', false, 'field', v_name, 'message', 'Please enter a real date for: ' || rtrim(f->>'label', '?.') || '.');
      END;
      IF f->>'rule' = 'past' AND (v_date >= current_date OR v_date < current_date - interval '100 years') THEN
        RETURN jsonb_build_object('ok', false, 'field', v_name, 'message', (f->>'label') || ' must be a date in the past.');
      END IF;
      IF f->>'rule' = 'today_or_future' AND (v_date < current_date OR v_date > current_date + 90) THEN
        RETURN jsonb_build_object('ok', false, 'field', v_name, 'message', (f->>'label') || ' must be between today and 90 days from now.');
      END IF;
      v := v_date::text;
    END IF;
    IF f ? 'pattern' AND v !~ (f->>'pattern') THEN
      RETURN jsonb_build_object('ok', false, 'field', v_name, 'message', COALESCE(f->>'pattern_msg', 'Please check: ' || (f->>'label') || '.'));
    END IF;
    v_out := v_out || jsonb_build_object(v_name, v);
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'details', v_out);
END $$;

-- Extra checks for one form: does the postcode belong to the state? (a common mistake)
CREATE OR REPLACE FUNCTION private.postcode_matches_state(p_postcode text, p_state text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE p_state
    WHEN 'NSW' THEN p_postcode ~ '^2' AND NOT (p_postcode::int BETWEEN 2600 AND 2619 OR p_postcode::int BETWEEN 2900 AND 2920)
    WHEN 'ACT' THEN p_postcode::int BETWEEN 2600 AND 2619 OR p_postcode::int BETWEEN 2900 AND 2920
    WHEN 'VIC' THEN p_postcode ~ '^3'
    WHEN 'QLD' THEN p_postcode ~ '^4'
    WHEN 'SA'  THEN p_postcode ~ '^5'
    WHEN 'WA'  THEN p_postcode ~ '^6'
    WHEN 'TAS' THEN p_postcode ~ '^7'
    WHEN 'NT'  THEN p_postcode ~ '^0'
    ELSE false END
$$;

-- Tell the team (and the organisation's team leaders) about a request
CREATE OR REPLACE FUNCTION private.notify_request_team(p_req uuid, p_title text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO public.notifications (user_id, type, title, link)
  SELECT u.user_id, 'new_request', left(p_title, 120), '/requests/' || r.request_id
  FROM public.service_requests r
  JOIN public.request_types t ON t.type_key = r.type_key
  JOIN public.users u ON u.status = 'active' AND u.role IN ('support_agent', 'team_leader')
                     AND u.industry = r.industry
  LEFT JOIN public.teams tm ON tm.team_id = u.team_id
  WHERE r.request_id = p_req AND (tm.name = t.team_name OR u.role = 'team_leader')
$$;

-- ---------- a person sends a form ----------
CREATE OR REPLACE FUNCTION public.submit_service_request(p_type text, p_details jsonb, p_photo text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_cust    uuid := private.require_customer();
  v_user    uuid := private.my_user_id();
  v_t       public.request_types;
  v_check   jsonb;
  v_d       jsonb;
  v_prefill jsonb;
  v_open    text;
  v_order   uuid;
  v_req     uuid;
  v_num     text;
  v_needs_photo boolean;
BEGIN
  SELECT * INTO v_t FROM public.request_types WHERE type_key = p_type AND active AND industry = public.current_industry();
  IF NOT FOUND THEN RAISE EXCEPTION 'That form is not available.' USING ERRCODE = '22023'; END IF;

  -- one open request of each kind at a time (stops double sends)
  SELECT request_number INTO v_open FROM public.service_requests
  WHERE customer_id = v_cust AND type_key = p_type AND status IN ('submitted', 'in_review', 'needs_info')
    AND (p_type <> 'delivery_address' OR details->>'order' = p_details->>'order')
  LIMIT 1;
  IF v_open IS NOT NULL THEN
    RAISE EXCEPTION 'You already have this request in progress (%). You can follow it in My requests.', v_open USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(*) FROM public.service_requests WHERE customer_id = v_cust AND created_at > now() - interval '10 minutes') >= 5 THEN
    RAISE EXCEPTION 'You have sent several requests in the last few minutes. Please wait a little.' USING ERRCODE = '22023';
  END IF;

  v_prefill := private.request_prefill(v_cust);
  v_check := private.check_request_details(v_t.fields, COALESCE(p_details, '{}'::jsonb), v_prefill);
  IF NOT (v_check->>'ok')::boolean THEN RAISE EXCEPTION '%', v_check->>'message' USING ERRCODE = '22023'; END IF;
  v_d := v_check->'details';

  -- the photo must be the person's own upload
  v_needs_photo := EXISTS (SELECT 1 FROM jsonb_array_elements(v_t.fields) f WHERE f->>'type' = 'photo' AND (f->>'required')::boolean);
  IF p_photo IS NOT NULL AND p_photo <> '' THEN
    IF p_photo !~ ('^' || (SELECT auth.uid())::text || '/[A-Za-z0-9-]+\.(jpg|jpeg|png|webp)$')
       OR NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'request-photos' AND o.name = p_photo) THEN
      RAISE EXCEPTION 'Your photo did not upload correctly. Please add it again.' USING ERRCODE = '22023';
    END IF;
  ELSIF v_needs_photo THEN
    RAISE EXCEPTION 'Please add your photo.' USING ERRCODE = '22023';
  END IF;

  -- form-specific checks
  IF p_type = 'delivery_address' THEN
    IF NOT private.postcode_matches_state(v_d->>'postcode', v_d->>'state') THEN
      RAISE EXCEPTION 'Postcode % is not in %. Please check the postcode and state.', v_d->>'postcode', v_d->>'state' USING ERRCODE = '22023';
    END IF;
    SELECT order_id INTO v_order FROM public.orders
    WHERE order_number = v_d->>'order' AND customer_id = v_cust AND status IN ('placed', 'processing');
    IF v_order IS NULL THEN RAISE EXCEPTION 'That order has already shipped, so its address cannot be changed.' USING ERRCODE = '22023'; END IF;
  END IF;

  INSERT INTO public.service_requests (type_key, customer_id, industry, details, photo_path, order_id, due_at)
  VALUES (p_type, v_cust, v_t.industry, v_d, NULLIF(p_photo, ''), v_order, now() + make_interval(hours => v_t.sla_hours))
  RETURNING request_id, request_number INTO v_req, v_num;

  INSERT INTO public.service_request_events (request_id, status, note, actor_name, actor_type)
  VALUES (v_req, 'submitted', 'Form sent. All details checked.', (SELECT name FROM public.users WHERE user_id = v_user), 'person');
  INSERT INTO public.audit_logs (user_id, actor, actor_type, action, entity_type, entity_id, result, risk_level, details)
  VALUES (v_user, CASE WHEN v_t.industry = 'university' THEN 'Student' ELSE 'Customer' END, 'human', 'request_submitted',
          'service_requests', v_req, 'success', 'low', jsonb_build_object('request', v_num, 'form', v_t.title, 'team', v_t.team_name));
  PERFORM private.notify_request_team(v_req, v_num || ': new ' || v_t.title || ' request');

  RETURN jsonb_build_object('request_id', v_req, 'request_number', v_num, 'team', v_t.team_name, 'sla_hours', v_t.sla_hours);
END $$;
REVOKE EXECUTE ON FUNCTION public.submit_service_request(text, jsonb, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.submit_service_request(text, jsonb, text) TO authenticated;

-- ---------- the person fixes a request staff sent back, or cancels it ----------
CREATE OR REPLACE FUNCTION public.update_my_service_request(p_id uuid, p_action text, p_details jsonb DEFAULT NULL, p_photo text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_cust  uuid := private.require_customer();
  v_user  uuid := private.my_user_id();
  v_r     public.service_requests;
  v_t     public.request_types;
  v_check jsonb;
BEGIN
  SELECT * INTO v_r FROM public.service_requests WHERE request_id = p_id AND customer_id = v_cust FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That request could not be found.' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_t FROM public.request_types WHERE type_key = v_r.type_key;

  IF p_action = 'cancel' THEN
    IF v_r.status NOT IN ('submitted', 'needs_info') THEN
      RAISE EXCEPTION 'This request is already being worked on, so it can no longer be cancelled here.' USING ERRCODE = '22023';
    END IF;
    UPDATE public.service_requests SET status = 'cancelled', updated_at = now() WHERE request_id = p_id;
    INSERT INTO public.service_request_events (request_id, status, note, actor_name, actor_type)
    VALUES (p_id, 'cancelled', 'Cancelled by the requester.', (SELECT name FROM public.users WHERE user_id = v_user), 'person');
    RETURN jsonb_build_object('status', 'cancelled');
  END IF;

  IF p_action <> 'resubmit' THEN RAISE EXCEPTION 'Unknown action.' USING ERRCODE = '22023'; END IF;
  IF v_r.status <> 'needs_info' THEN RAISE EXCEPTION 'This request does not need any changes.' USING ERRCODE = '22023'; END IF;
  v_check := private.check_request_details(v_t.fields, COALESCE(p_details, '{}'::jsonb), private.request_prefill(v_cust));
  IF NOT (v_check->>'ok')::boolean THEN RAISE EXCEPTION '%', v_check->>'message' USING ERRCODE = '22023'; END IF;
  IF p_photo IS NOT NULL AND p_photo <> '' AND (p_photo !~ ('^' || (SELECT auth.uid())::text || '/[A-Za-z0-9-]+\.(jpg|jpeg|png|webp)$')
       OR NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'request-photos' AND o.name = p_photo)) THEN
    RAISE EXCEPTION 'Your photo did not upload correctly. Please add it again.' USING ERRCODE = '22023';
  END IF;
  IF v_r.type_key = 'delivery_address' AND NOT private.postcode_matches_state(v_check->'details'->>'postcode', v_check->'details'->>'state') THEN
    RAISE EXCEPTION 'That postcode is not in the state you chose. Please check them.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.service_requests
  SET details = v_check->'details', photo_path = COALESCE(NULLIF(p_photo, ''), photo_path), status = 'submitted', updated_at = now()
  WHERE request_id = p_id;
  INSERT INTO public.service_request_events (request_id, status, note, actor_name, actor_type)
  VALUES (p_id, 'submitted', 'Changes sent.', (SELECT name FROM public.users WHERE user_id = v_user), 'person');
  PERFORM private.notify_request_team(p_id, v_r.request_number || ': changes sent for ' || v_t.title);
  RETURN jsonb_build_object('status', 'submitted');
END $$;
REVOKE EXECUTE ON FUNCTION public.update_my_service_request(uuid, text, jsonb, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.update_my_service_request(uuid, text, jsonb, text) TO authenticated;

-- ---------- staff work on a request ----------
-- Actions: start | need_info | ready | collected | reject
CREATE OR REPLACE FUNCTION public.staff_update_service_request(p_id uuid, p_action text, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_me      uuid := private.my_user_id();
  v_me_name text;
  v_r       public.service_requests;
  v_t       public.request_types;
  v_owner   uuid;
  v_note    text := NULLIF(btrim(COALESCE(p_note, '')), '');
  v_status  text;
  v_outcome jsonb := '{}'::jsonb;
  v_pickup  boolean := false;
  v_msg     text;
  v_place   text;
  v_addr    text;
  v_old     text;
  v_no      int;
BEGIN
  IF NOT private.has_permission('view_cases') THEN RAISE EXCEPTION 'Only staff can do this.' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_r FROM public.service_requests WHERE request_id = p_id FOR UPDATE;
  IF NOT FOUND OR v_r.industry <> public.current_industry() THEN RAISE EXCEPTION 'That request could not be found.' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_t FROM public.request_types WHERE type_key = v_r.type_key;
  SELECT name INTO v_me_name FROM public.users WHERE user_id = v_me;
  SELECT user_id INTO v_owner FROM public.customers WHERE customer_id = v_r.customer_id;
  v_place := CASE WHEN v_r.industry = 'university' THEN 'the Student Centre, Building A, ground floor (Mon–Fri, 9am–5pm). Bring photo ID'
                  ELSE 'our warehouse' END;
  IF v_note IS NOT NULL AND length(v_note) > 500 THEN RAISE EXCEPTION 'Please keep the note under 500 characters.' USING ERRCODE = '22023'; END IF;

  IF p_action = 'start' THEN
    IF v_r.status NOT IN ('submitted') THEN RAISE EXCEPTION 'This request is not waiting to be started.' USING ERRCODE = '22023'; END IF;
    v_status := 'in_review';
    v_msg := v_r.request_number || ': ' || v_me_name || ' is working on your ' || v_t.title;

  ELSIF p_action = 'need_info' THEN
    IF v_r.status NOT IN ('submitted', 'in_review') THEN RAISE EXCEPTION 'Changes can only be asked for before the request is finished.' USING ERRCODE = '22023'; END IF;
    IF v_note IS NULL OR length(v_note) < 10 THEN RAISE EXCEPTION 'Please say what needs changing (at least 10 characters).' USING ERRCODE = '22023'; END IF;
    v_status := 'needs_info';
    v_msg := v_r.request_number || ': please check your ' || v_t.title || ' request';

  ELSIF p_action = 'reject' THEN
    IF v_r.status NOT IN ('submitted', 'in_review', 'needs_info') THEN RAISE EXCEPTION 'This request is already finished.' USING ERRCODE = '22023'; END IF;
    IF v_note IS NULL OR length(v_note) < 10 THEN RAISE EXCEPTION 'Please give the reason (at least 10 characters).' USING ERRCODE = '22023'; END IF;
    v_status := 'rejected';
    v_msg := v_r.request_number || ': your ' || v_t.title || ' request could not be completed';

  ELSIF p_action = 'collected' THEN
    IF v_r.status <> 'ready' THEN RAISE EXCEPTION 'Only a request that is ready to collect can be marked as collected.' USING ERRCODE = '22023'; END IF;
    v_status := 'completed';
    v_outcome := jsonb_build_object('collected_at', now(), 'collected_by_staff', v_me_name);
    v_msg := v_r.request_number || ': collected. Thank you!';

  ELSIF p_action = 'ready' THEN
    IF v_r.status NOT IN ('submitted', 'in_review') THEN RAISE EXCEPTION 'This request is not ready to be finished.' USING ERRCODE = '22023'; END IF;
    v_pickup := COALESCE(v_r.details->>'delivery', '') IN ('Digital card + collect a physical card', 'Digital letter + printed copy to collect', 'Collect from the Student Centre');

    IF v_r.type_key = 'id_card' THEN
      SELECT count(*) + 1 INTO v_no FROM public.service_requests
      WHERE customer_id = v_r.customer_id AND type_key = 'id_card' AND outcome ? 'card_number';
      v_outcome := jsonb_build_object('card_number', (v_r.details->>'student_number') || '-' || v_no,
                     'issued', current_date, 'expires', (date_trunc('year', current_date) + interval '4 years - 1 day')::date,
                     'digital', true);
      v_msg := v_r.request_number || ': your student ID card is ready' || CASE WHEN v_pickup THEN ' to collect' ELSE '' END;

    ELSIF v_r.type_key = 'enrolment_letter' THEN
      v_outcome := jsonb_build_object('reference', 'EL-' || substr(v_r.request_number, 4), 'issued', current_date, 'issued_by', v_me_name);
      v_msg := v_r.request_number || ': your enrolment letter is ready';

    ELSIF v_r.type_key = 'transcript' THEN
      v_outcome := jsonb_build_object('reference', 'TR-' || substr(v_r.request_number, 4), 'issued', current_date, 'issued_by', v_me_name,
                     'sent', CASE v_r.details->>'delivery' WHEN 'Email me a PDF' THEN 'Emailed as a PDF'
                                                          WHEN 'Post to me' THEN 'Posted to ' || (v_r.details->>'postal_address') ELSE NULL END);
      v_msg := v_r.request_number || ': your transcript is ' || CASE WHEN v_pickup THEN 'ready to collect' ELSE 'on its way' END;

    ELSIF v_r.type_key = 'parking_permit' THEN
      v_outcome := jsonb_build_object('permit_number', 'P' || substr(v_r.request_number, 4) || '-' || (v_r.details->>'rego'),
                     'valid_from', (v_r.details->>'start_date')::date,
                     'valid_to', CASE WHEN v_r.details->>'permit' LIKE 'Semester%' THEN ((v_r.details->>'start_date')::date + interval '5 months')::date
                                      WHEN v_r.details->>'permit' LIKE 'Full year%' THEN ((v_r.details->>'start_date')::date + interval '1 year - 1 day')::date
                                      ELSE (v_r.details->>'start_date')::date END);
      v_msg := v_r.request_number || ': your parking permit is active';

    ELSIF v_r.type_key = 'credit_transfer' THEN
      -- the assessor confirms the units the AI could not decide alone
      v_outcome := jsonb_build_object('assessor', v_me_name, 'assessor_date', current_date);
      v_msg := v_r.request_number || ': your credit decision is complete';

    ELSIF v_r.type_key = 'delivery_address' THEN
      -- make the change on the order itself, if it still hasn't shipped
      v_addr := concat_ws(', ', v_r.details->>'line1', NULLIF(v_r.details->>'line2', ''),
                          (v_r.details->>'suburb') || ' ' || (v_r.details->>'state') || ' ' || (v_r.details->>'postcode'));
      SELECT ship_address INTO v_old FROM public.orders WHERE order_id = v_r.order_id AND status IN ('placed', 'processing') FOR UPDATE;
      IF v_old IS NULL THEN RAISE EXCEPTION 'The order has already shipped, so the address can no longer be changed. Please reject the request with a note.' USING ERRCODE = '22023'; END IF;
      UPDATE public.orders SET ship_address = left(v_addr, 400), ship_recipient = left(v_r.details->>'recipient', 100),
             updated_at = now()
      WHERE order_id = v_r.order_id;
      INSERT INTO public.order_events (order_id, status, note)
      SELECT v_r.order_id, o.status, left('Delivery address changed to ' || v_addr
                    || COALESCE('. Instructions: ' || NULLIF(v_r.details->>'instructions', ''), ''), 200)
      FROM public.orders o WHERE o.order_id = v_r.order_id;
      v_outcome := jsonb_build_object('old_address', v_old, 'new_address', v_addr);
      v_msg := v_r.request_number || ': delivery address changed for ' || (v_r.details->>'order');
    END IF;

    IF v_pickup THEN v_outcome := v_outcome || jsonb_build_object('pickup', 'Collect from ' || v_place || '.'); END IF;
    v_status := CASE WHEN v_pickup THEN 'ready' ELSE 'completed' END;
  ELSE
    RAISE EXCEPTION 'Unknown action.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.service_requests SET
    status = v_status, updated_at = now(),
    assigned_to = COALESCE(assigned_to, v_me),
    staff_note = CASE WHEN p_action IN ('need_info', 'reject') THEN v_note ELSE COALESCE(v_note, staff_note) END,
    outcome = outcome || v_outcome,
    ready_at = CASE WHEN p_action = 'ready' THEN now() ELSE ready_at END,
    completed_at = CASE WHEN v_status IN ('completed', 'rejected') THEN now() ELSE completed_at END
  WHERE request_id = p_id;

  INSERT INTO public.service_request_events (request_id, status, note, actor_name, actor_type)
  VALUES (p_id, v_status, COALESCE(v_note, CASE p_action WHEN 'start' THEN 'Started checking the details.'
                                                    WHEN 'ready' THEN CASE WHEN v_pickup THEN 'Ready to collect.' ELSE 'Done.' END
                                                    WHEN 'collected' THEN 'Collected.' END), v_me_name, 'staff');
  INSERT INTO public.audit_logs (user_id, actor, actor_type, action, entity_type, entity_id, result, risk_level, details)
  VALUES (v_me, v_me_name, 'human', 'request_' || p_action, 'service_requests', p_id, 'success', 'low',
          jsonb_build_object('request', v_r.request_number, 'form', v_t.title, 'status', v_status));
  INSERT INTO public.notifications (user_id, type, title, link)
  VALUES (v_owner, 'request_update', left(v_msg, 120), '/account/requests/' || p_id);

  RETURN jsonb_build_object('status', v_status, 'outcome', v_outcome);
END $$;
REVOKE EXECUTE ON FUNCTION public.staff_update_service_request(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.staff_update_service_request(uuid, text, text) TO authenticated;

-- ---------- numbers for the staff queue ----------
CREATE OR REPLACE FUNCTION public.service_request_stats(p_days int DEFAULT 30) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_ind text := public.current_industry();
BEGIN
  IF NOT private.has_permission('view_cases') THEN RAISE EXCEPTION 'Only staff can see this.' USING ERRCODE = '42501'; END IF;
  RETURN (
    WITH w AS (
      SELECT r.*, EXISTS (SELECT 1 FROM public.service_request_events e WHERE e.request_id = r.request_id AND e.status = 'needs_info') AS sent_back
      FROM public.service_requests r
      WHERE r.industry = v_ind AND r.created_at > now() - make_interval(days => GREATEST(1, LEAST(p_days, 365))))
    SELECT jsonb_build_object(
      'total', count(*),
      'open', count(*) FILTER (WHERE status IN ('submitted', 'in_review', 'needs_info')),
      'overdue', count(*) FILTER (WHERE status IN ('submitted', 'in_review') AND due_at < now()),
      'to_collect', count(*) FILTER (WHERE status = 'ready'),
      'finished', count(*) FILTER (WHERE ready_at IS NOT NULL OR status = 'completed'),
      'first_time_right', count(*) FILTER (WHERE (ready_at IS NOT NULL OR status = 'completed') AND NOT sent_back),
      'median_hours', round((percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM (COALESCE(ready_at, completed_at) - created_at)) / 3600)
                       FILTER (WHERE COALESCE(ready_at, completed_at) IS NOT NULL))::numeric, 1)
    ) FROM w);
END $$;
GRANT EXECUTE ON FUNCTION public.service_request_stats(int) TO authenticated;

-- ---------- live updates ----------
DO $$
DECLARE t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['service_requests', 'service_request_events'] LOOP
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END $$;

-- ---------- help article: the AI points to the form ----------
UPDATE public.knowledge_documents SET content =
  'You can apply for your student ID card online in about 2 minutes: choose "Requests & forms" (or ask me here) and fill in the Student ID card form with a photo. '
  || 'The Student Centre checks it, usually within 1 business day. You get a digital card straight away when it is ready, and can collect a physical card from the Student Centre (Building A, ground floor) with photo ID. '
  || 'If your card is lost or stolen, report it in the Student Hub straight away; a replacement costs $25.',
  updated_at = now()
WHERE title = 'Student ID card' AND industry = 'university';

COMMIT;
