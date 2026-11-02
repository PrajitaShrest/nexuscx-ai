-- =====================================================================
-- NexusCX AI - Migration 024: university cases say "student", not "customer"
-- Run AFTER 023_university_staff.sql, in the Supabase SQL Editor.
-- Safe to run more than once.
--
-- The database writes short texts such as "CX-10474: customer replied"
-- (inbox) and the actor "Customer" (audit log). For university cases these
-- now say "student". E-commerce cases are not changed.
-- Existing inbox items are fixed too. Old audit entries are left as they
-- were written (the audit log is a record and is not rewritten).
-- =====================================================================
BEGIN;

CREATE OR REPLACE FUNCTION private.student_word(t text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT replace(replace(replace(replace(t,
    'Customers', 'Students'), 'customers', 'students'),
    'Customer', 'Student'), 'customer', 'student')
$$;

-- Inbox items
CREATE OR REPLACE FUNCTION private.notification_student_wording() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.case_id IS NOT NULL
     AND (SELECT industry FROM public.cases WHERE case_id = NEW.case_id) = 'university' THEN
    NEW.title := private.student_word(NEW.title);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_student_wording ON public.notifications;
CREATE TRIGGER trg_student_wording BEFORE INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION private.notification_student_wording();

-- Audit log: new entries for university cases
CREATE OR REPLACE FUNCTION private.audit_student_wording() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.case_id IS NOT NULL
     AND (SELECT industry FROM public.cases WHERE case_id = NEW.case_id) = 'university' THEN
    NEW.actor  := private.student_word(NEW.actor);
    NEW.action := private.student_word(NEW.action);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_audit_student_wording ON public.audit_logs;
CREATE TRIGGER trg_audit_student_wording BEFORE INSERT ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION private.audit_student_wording();

REVOKE EXECUTE ON FUNCTION private.notification_student_wording(), private.audit_student_wording() FROM public, anon, authenticated;

-- Fix the inbox items already there
UPDATE public.notifications n SET title = private.student_word(n.title)
FROM public.cases c
WHERE c.case_id = n.case_id AND c.industry = 'university' AND n.title ~* 'customer';

COMMIT;
