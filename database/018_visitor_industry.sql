-- =====================================================================
-- NexusCX AI - Migration 018: each visitor can choose the demo pack
-- Run AFTER 017_university_pack.sql, once, in the Supabase SQL Editor.
--
-- The website sends the visitor's choice ("E-commerce demo" or
-- "University demo", saved in their browser) as the request header
-- x-nexus-industry. current_industry() uses that choice for that request
-- only, so two people can use different packs at the same time.
-- Without a choice, the "industry" setting is the default.
--
-- The header only picks WHICH pack's agents, articles and cases are used.
-- It never gives access to anything else: all the role and ownership
-- rules still apply.
-- =====================================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.current_industry() RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_choice text;
BEGIN
  BEGIN
    v_choice := nullif(current_setting('request.headers', true), '')::json ->> 'x-nexus-industry';
  EXCEPTION WHEN others THEN
    v_choice := NULL;  -- no headers (SQL Editor, seeding) or unreadable headers
  END;
  IF v_choice IN ('ecommerce', 'university') THEN
    RETURN v_choice;
  END IF;
  RETURN coalesce((SELECT value #>> '{}' FROM public.platform_settings WHERE setting_key = 'industry'), 'ecommerce');
END $$;
GRANT EXECUTE ON FUNCTION public.current_industry() TO anon, authenticated;

UPDATE public.platform_settings
SET description = 'Default industry pack for visitors who have not chosen one (ecommerce or university)'
WHERE setting_key = 'industry';

COMMIT;

-- Check: the default pack
SELECT public.current_industry() AS default_pack;
