-- =====================================================================
-- NexusCX AI - Migration 007: sign-in protection, phone and terms
-- Run AFTER 006_username_and_dob.sql, once, in the Supabase SQL Editor.
--
-- 1. login_attempts: every sign-in attempt (email stored only as a hash).
--    5 failed attempts within 15 minutes locks that account for 15 minutes.
-- 2. login_lock_status() and record_login_attempt(): called by the app
--    before and after each sign-in. Lock events and staff sign-ins are
--    written to audit_logs.
-- 3. customers.terms_accepted_at, and the sign-up trigger now stores the
--    phone number and the time the customer accepted the terms.
-- =====================================================================
BEGIN;

-- ---------- 1. sign-in attempts ----------
CREATE TABLE public.login_attempts (
    attempt_id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email_hash   CHAR(64) NOT NULL,              -- sha256 of the lower-case email, never the email itself
    success      BOOLEAN NOT NULL,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_login_attempts_lookup ON public.login_attempts (email_hash, attempted_at DESC);
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
-- No grants and no policies: only the two functions below can read or write it.

CREATE OR REPLACE FUNCTION private.email_hash(p_email text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT encode(extensions.digest(lower(trim(p_email)), 'sha256'), 'hex')
$$;

-- Seconds until the account can try again (0 = not locked)
CREATE OR REPLACE FUNCTION public.login_lock_status(p_email text)
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_hash      text := private.email_hash(p_email);
  v_last_ok   timestamptz;
  v_failures  int;
  v_last_fail timestamptz;
BEGIN
  SELECT max(attempted_at) INTO v_last_ok FROM public.login_attempts
  WHERE email_hash = v_hash AND success;

  SELECT count(*), max(attempted_at) INTO v_failures, v_last_fail FROM public.login_attempts
  WHERE email_hash = v_hash AND NOT success
    AND attempted_at > now() - interval '15 minutes'
    AND attempted_at > COALESCE(v_last_ok, '-infinity');

  IF v_failures >= 5 THEN
    RETURN GREATEST(0, ceil(EXTRACT(EPOCH FROM (v_last_fail + interval '15 minutes' - now())))::int);
  END IF;
  RETURN 0;
END $$;

-- Record one attempt; returns the seconds locked after this attempt
CREATE OR REPLACE FUNCTION public.record_login_attempt(p_email text, p_success boolean)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_locked  int;
  v_user    record;
BEGIN
  IF p_email IS NULL OR length(trim(p_email)) = 0 THEN RETURN 0; END IF;
  INSERT INTO public.login_attempts (email_hash, success) VALUES (private.email_hash(p_email), p_success);

  SELECT user_id, name, role INTO v_user FROM public.users WHERE lower(email) = lower(trim(p_email));
  v_locked := public.login_lock_status(p_email);

  IF NOT p_success AND v_locked > 0 THEN
    INSERT INTO public.audit_logs (user_id, actor, actor_type, action, entity_type, entity_id, result, risk_level, details)
    VALUES (v_user.user_id, 'Sign-in protection', 'system', 'account_locked', 'users', v_user.user_id, 'blocked', 'medium',
            jsonb_build_object('minutes', 15));
  ELSIF p_success AND v_user.role IS NOT NULL AND v_user.role <> 'customer' THEN
    INSERT INTO public.audit_logs (user_id, actor, actor_type, action, entity_type, entity_id, result, risk_level)
    VALUES (v_user.user_id, v_user.name, 'human', 'staff_signed_in', 'users', v_user.user_id, 'success', 'low');
  END IF;
  RETURN v_locked;
END $$;

-- Old attempts are only needed for 30 days
CREATE OR REPLACE FUNCTION public.purge_old_login_attempts()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  DELETE FROM public.login_attempts WHERE attempted_at < now() - interval '30 days'
$$;

REVOKE EXECUTE ON FUNCTION private.email_hash(text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.login_lock_status(text), public.record_login_attempt(text, boolean),
                           public.purge_old_login_attempts() FROM public;
GRANT EXECUTE ON FUNCTION public.login_lock_status(text), public.record_login_attempt(text, boolean) TO anon, authenticated;

-- ---------- 2. terms acceptance ----------
ALTER TABLE public.customers ADD COLUMN terms_accepted_at TIMESTAMPTZ;

-- ---------- 3. sign-up trigger: also store phone and terms acceptance ----------
CREATE OR REPLACE FUNCTION private.handle_new_auth_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_meta     jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  v_name     text := COALESCE(NULLIF(trim(v_meta ->> 'full_name'), ''), split_part(NEW.email, '@', 1));
  v_username text := NULLIF(lower(trim(v_meta ->> 'username')), '');
  v_dob      date := NULLIF(v_meta ->> 'date_of_birth', '')::date;
  v_phone    text := NULLIF(regexp_replace(COALESCE(v_meta ->> 'phone', ''), '[^0-9+]', '', 'g'), '');
  v_terms    timestamptz := NULLIF(v_meta ->> 'terms_accepted_at', '')::timestamptz;
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
    INSERT INTO public.customers (user_id, date_of_birth, phone, terms_accepted_at)
    VALUES (v_user_id, v_dob, left(v_phone, 20), v_terms);
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION private.handle_new_auth_user() FROM public, anon, authenticated;

COMMIT;

-- Check: the new table exists and is locked down (rls on, no policies)
SELECT tablename, rowsecurity AS rls_enabled,
       (SELECT count(*) FROM pg_policies p WHERE p.tablename = 'login_attempts') AS policies
FROM pg_tables WHERE schemaname = 'public' AND tablename = 'login_attempts';
