-- =====================================================================
-- NexusCX AI - Migration 021: each account belongs to one organisation
-- Run AFTER 020_less_work_for_staff.sql, once, in the Supabase SQL Editor.
--
-- The store (E-commerce pack) and Northbridge University (University pack)
-- are two different organisations on one platform. So:
--   * users.industry says which organisation an account belongs to.
--     Customers, students, support agents and team leaders belong to ONE.
--     NULL = platform team (administrators, knowledge managers, business
--     specialists), who can switch between packs for the demo.
--   * current_industry() now uses the signed-in person's organisation first.
--     A student can never see or use the store, even by changing the
--     browser, and a shop customer can never see the university.
--   * Staff only see customers/students of the pack they are in, and only
--     get notifications for their own organisation's cases.
--   * New sign-ups belong to the pack they signed up in.
--   * Demo people for Northbridge (students and staff). Their logins are
--     made in Supabase -> Authentication -> Add user (same email, Auto
--     Confirm); the login links itself to the person, as for other staff.
--   * The sample university cases move to the university students.
-- =====================================================================
BEGIN;

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS industry varchar(20)
  CHECK (industry IN ('ecommerce', 'university'));

-- Everyone who exists today belongs to the store, except the platform team
UPDATE public.users SET industry = 'ecommerce'
WHERE industry IS NULL AND role IN ('customer', 'support_agent', 'team_leader');

-- ---------- the signed-in person's organisation comes first ----------
CREATE OR REPLACE FUNCTION public.current_industry() RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_own    text;
  v_choice text;
BEGIN
  -- 1. the account's own organisation (cannot be changed from the browser)
  SELECT u.industry INTO v_own FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid());
  IF v_own IS NOT NULL THEN RETURN v_own; END IF;
  -- 2. the visitor's chosen demo (platform team, or not signed in)
  BEGIN
    v_choice := nullif(current_setting('request.headers', true), '')::json ->> 'x-nexus-industry';
  EXCEPTION WHEN others THEN
    v_choice := NULL;
  END;
  IF v_choice IN ('ecommerce', 'university') THEN RETURN v_choice; END IF;
  -- 3. the default from Settings
  RETURN coalesce((SELECT value #>> '{}' FROM public.platform_settings WHERE setting_key = 'industry'), 'ecommerce');
END $$;
GRANT EXECUTE ON FUNCTION public.current_industry() TO anon, authenticated;

-- What the website needs to know about the signed-in person's organisation
CREATE OR REPLACE FUNCTION public.my_organisation() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT u.industry FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid())
$$;
GRANT EXECUTE ON FUNCTION public.my_organisation() TO authenticated;

-- ---------- staff only see their own organisation's customers/students ----------
DROP POLICY IF EXISTS "Active industry only" ON public.customers;
CREATE POLICY "Active industry only" ON public.customers AS RESTRICTIVE FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.user_id = customers.user_id
                 AND (u.industry IS NULL OR u.industry = (SELECT public.current_industry()))));

-- ---------- notifications only go to the case's own organisation ----------
CREATE OR REPLACE FUNCTION private.notify_own_organisation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_staff text;
  v_case  text;
BEGIN
  IF NEW.case_id IS NULL THEN RETURN NEW; END IF;
  SELECT industry INTO v_staff FROM public.users WHERE user_id = NEW.user_id;
  SELECT industry INTO v_case FROM public.cases WHERE case_id = NEW.case_id;
  IF v_staff IS NOT NULL AND v_case IS NOT NULL AND v_staff <> v_case THEN
    RETURN NULL;   -- not their organisation: skip quietly
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_own_org ON public.notifications;
CREATE TRIGGER trg_notify_own_org BEFORE INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION private.notify_own_organisation();

-- ---------- sign-up: the new account belongs to the pack it signed up in ----------
CREATE OR REPLACE FUNCTION private.handle_new_auth_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_meta     jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  v_name     text := COALESCE(NULLIF(trim(v_meta ->> 'full_name'), ''), split_part(NEW.email, '@', 1));
  v_username text := NULLIF(lower(trim(v_meta ->> 'username')), '');
  v_dob      date := NULLIF(v_meta ->> 'date_of_birth', '')::date;
  v_phone    text := NULLIF(regexp_replace(COALESCE(v_meta ->> 'phone', ''), '[^0-9+]', '', 'g'), '');
  v_terms    timestamptz := NULLIF(v_meta ->> 'terms_accepted_at', '')::timestamptz;
  v_org      text := CASE WHEN v_meta ->> 'industry' IN ('ecommerce', 'university') THEN v_meta ->> 'industry' ELSE 'ecommerce' END;
  v_user_id  uuid;
BEGIN
  -- Existing (seeded) person with the same email: link the login to them
  UPDATE public.users SET auth_user_id = NEW.id
  WHERE lower(email) = lower(NEW.email) AND auth_user_id IS NULL
  RETURNING user_id INTO v_user_id;

  IF v_user_id IS NULL THEN
    IF v_username IS NULL THEN
      v_username := lower(regexp_replace(split_part(NEW.email, '@', 1), '[^a-zA-Z0-9._]', '', 'g'))
                    || '_' || substr(replace(NEW.id::text, '-', ''), 1, 4);
    END IF;
    INSERT INTO public.users (user_id, name, email, username, role, auth_user_id, presence, last_active_at, industry)
    VALUES (NEW.id, left(v_name, 100), NEW.email, v_username, 'customer', NEW.id, 'online', now(), v_org)
    RETURNING user_id INTO v_user_id;
    INSERT INTO public.customers (user_id, date_of_birth, phone, terms_accepted_at)
    VALUES (v_user_id, v_dob, left(v_phone, 20), v_terms);
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION private.handle_new_auth_user() FROM public, anon, authenticated;

-- ---------- Northbridge demo people ----------
INSERT INTO public.teams (name, description)
SELECT 'Northbridge Student Services', 'Northbridge University student support (demo)'
WHERE NOT EXISTS (SELECT 1 FROM public.teams WHERE name = 'Northbridge Student Services');

INSERT INTO public.users (name, email, username, role, presence, industry, team_id)
SELECT v.name, v.email, v.username, v.role, v.presence, 'university',
       CASE WHEN v.role <> 'customer' THEN (SELECT team_id FROM public.teams WHERE name = 'Northbridge Student Services') END
FROM (VALUES
  ('Priya Sharma', 'priya.sharma@example.test', 'priya.sharma', 'customer', 'offline'),
  ('Liam Chen',    'liam.chen@example.test',    'liam.chen',    'customer', 'offline'),
  ('Aisha Rahman', 'aisha.rahman@example.test', 'aisha.rahman', 'customer', 'offline'),
  ('Ella Martin',  'ella.martin@example.test',  'ella.martin',  'support_agent', 'online'),
  ('Dr Chris Wong','chris.wong@example.test',   'chris.wong',   'team_leader', 'online')
) AS v(name, email, username, role, presence)
WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE lower(u.email) = lower(v.email));

INSERT INTO public.customers (user_id, date_of_birth)
SELECT u.user_id, DATE '2002-03-14' + (row_number() OVER (ORDER BY u.name))::int * 200
FROM public.users u
WHERE u.industry = 'university' AND u.role = 'customer'
  AND NOT EXISTS (SELECT 1 FROM public.customers c WHERE c.user_id = u.user_id);

-- ---------- the sample university cases belong to university students ----------
DO $$
DECLARE
  v_students uuid[];
  r record;
  v_i int := 0;
  v_cust uuid;
BEGIN
  SELECT array_agg(c.customer_id ORDER BY u.name) INTO v_students
  FROM public.customers c JOIN public.users u ON u.user_id = c.user_id
  WHERE u.industry = 'university' AND u.role = 'customer';
  IF v_students IS NULL THEN RETURN; END IF;
  FOR r IN SELECT k.case_id, k.customer_id FROM public.cases k
           JOIN public.customers c ON c.customer_id = k.customer_id
           JOIN public.users u ON u.user_id = c.user_id
           WHERE k.industry = 'university' AND u.industry IS DISTINCT FROM 'university'
           ORDER BY k.created_at LOOP
    v_i := v_i + 1;
    v_cust := v_students[1 + (v_i % array_length(v_students, 1))];
    UPDATE public.messages m SET sender_id = (SELECT user_id FROM public.customers WHERE customer_id = v_cust)
    FROM public.conversations v
    WHERE v.conversation_id = m.conversation_id AND v.case_id = r.case_id AND m.sender_type = 'customer';
    UPDATE public.notifications SET user_id = (SELECT user_id FROM public.customers WHERE customer_id = v_cust)
    WHERE case_id = r.case_id AND user_id = (SELECT user_id FROM public.customers WHERE customer_id = r.customer_id);
    UPDATE public.cases SET customer_id = v_cust WHERE case_id = r.case_id;
  END LOOP;

  -- the sample staff replies on university cases come from university staff
  UPDATE public.case_assignments a SET user_id = (SELECT user_id FROM public.users WHERE email = 'ella.martin@example.test')
  FROM public.cases k WHERE k.case_id = a.case_id AND k.industry = 'university'
    AND (SELECT industry FROM public.users WHERE user_id = a.user_id) IS DISTINCT FROM 'university';
  UPDATE public.messages m SET sender_id = (SELECT user_id FROM public.users WHERE email = 'ella.martin@example.test')
  FROM public.conversations v JOIN public.cases k ON k.case_id = v.case_id
  WHERE v.conversation_id = m.conversation_id AND k.industry = 'university' AND m.sender_type = 'human_agent'
    AND (SELECT industry FROM public.users WHERE user_id = m.sender_id) IS DISTINCT FROM 'university';
END $$;

COMMIT;
