-- =====================================================================
-- NexusCX AI - Migration 006: usernames and date of birth
-- Run AFTER 005_auth_and_security.sql, once, in the Supabase SQL Editor.
--
-- 1. users.username   - unique (ignoring case), 3-30 letters, numbers, . or _
--                       Users can sign in with their username OR their email.
-- 2. customers.date_of_birth - collected at sign-up. Nobody under 10 can
--                       register: checked in the app AND in the database.
-- 3. Two small public functions used by the login and sign-up pages:
--      username_available(name) -> true/false
--      login_email(name)        -> the email for a username (needed because
--                                  Supabase Auth signs in with an email)
-- =====================================================================
BEGIN;

-- ---------- 1. usernames ----------
ALTER TABLE public.users ADD COLUMN username VARCHAR(30);

-- Give existing (seeded) people a username from their email, e.g. riley.support
UPDATE public.users SET username = lower(regexp_replace(split_part(email, '@', 1), '[^a-zA-Z0-9._]', '', 'g'))
WHERE username IS NULL;

ALTER TABLE public.users
  ALTER COLUMN username SET NOT NULL,
  ADD CONSTRAINT users_username_format CHECK (username ~ '^[a-zA-Z0-9._]{3,30}$');
CREATE UNIQUE INDEX users_username_unique ON public.users (lower(username));

-- Users may change their own username (still unique)
GRANT UPDATE (username) ON public.users TO authenticated;

-- ---------- 2. date of birth ----------
ALTER TABLE public.customers ADD COLUMN date_of_birth DATE;
ALTER TABLE public.customers
  ADD CONSTRAINT customers_dob_not_future CHECK (date_of_birth IS NULL OR date_of_birth <= CURRENT_DATE) NOT VALID;

-- Minimum age, checked on every insert/update (a CHECK constraint cannot use today's date)
CREATE OR REPLACE FUNCTION private.check_minimum_age()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.date_of_birth IS NOT NULL AND NEW.date_of_birth > (CURRENT_DATE - INTERVAL '10 years')::date THEN
    RAISE EXCEPTION 'You must be at least 10 years old to create an account' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_customers_min_age BEFORE INSERT OR UPDATE OF date_of_birth ON public.customers
  FOR EACH ROW EXECUTE FUNCTION private.check_minimum_age();

-- ---------- 3. sign-up trigger now stores username and date of birth ----------
CREATE OR REPLACE FUNCTION private.handle_new_auth_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_name     text := COALESCE(NULLIF(trim(NEW.raw_user_meta_data ->> 'full_name'), ''), split_part(NEW.email, '@', 1));
  v_username text := NULLIF(lower(trim(NEW.raw_user_meta_data ->> 'username')), '');
  v_dob      date := NULLIF(NEW.raw_user_meta_data ->> 'date_of_birth', '')::date;
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
    INSERT INTO public.users (user_id, name, email, username, role, auth_user_id, presence, last_active_at)
    VALUES (NEW.id, left(v_name, 100), NEW.email, v_username, 'customer', NEW.id, 'online', now())
    RETURNING user_id INTO v_user_id;
    -- The minimum-age trigger on customers rejects anyone under 10,
    -- which cancels the whole sign-up (no account is created).
    INSERT INTO public.customers (user_id, date_of_birth) VALUES (v_user_id, v_dob);
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION private.handle_new_auth_user() FROM public, anon, authenticated;

-- ---------- 4. helper functions for the login and sign-up pages ----------
-- Is a username free? (Used before sign-up to give a clear message.)
CREATE OR REPLACE FUNCTION public.username_available(p_username text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.users WHERE lower(username) = lower(trim(p_username)))
$$;

-- Email for a username, so "sign in with username" can call Supabase Auth.
-- Trade-off (documented): anyone who knows a username can learn its email.
-- Accepted for this project; a production system would do this lookup
-- server-side with a key that is never exposed.
CREATE OR REPLACE FUNCTION public.login_email(p_username text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT email FROM public.users
  WHERE lower(username) = lower(trim(p_username)) AND status = 'active' AND auth_user_id IS NOT NULL
$$;

REVOKE EXECUTE ON FUNCTION public.username_available(text), public.login_email(text) FROM public;
GRANT EXECUTE ON FUNCTION public.username_available(text), public.login_email(text) TO anon, authenticated;

-- Customers may update their own date of birth (the age rule still applies)
GRANT UPDATE (date_of_birth) ON public.customers TO authenticated;

COMMIT;

-- Check: usernames given to existing people
SELECT name, username, role FROM public.users ORDER BY role, name;
