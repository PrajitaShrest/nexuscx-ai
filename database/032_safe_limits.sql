-- 032_safe_limits.sql  (run after 031)
-- The spam guard on new chats:
--   * never blocks a wellbeing or product-safety message (a person in crisis must always get through)
--   * allows 10 new chats in 10 minutes (was 5), so a busy student or a live demo is not stopped
-- Safe to run more than once.
CREATE OR REPLACE FUNCTION private.limit_new_cases() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF COALESCE(NEW.safety_flag, '') IN ('wellbeing', 'product_safety') THEN
    RETURN NEW;   -- duty of care: always let these through
  END IF;
  IF private.my_customer_id() IS NOT NULL AND NEW.customer_id = private.my_customer_id()
     AND (SELECT count(*) FROM public.cases c
          WHERE c.customer_id = NEW.customer_id AND c.created_at > now() - interval '10 minutes') >= 10 THEN
    RAISE EXCEPTION 'You have started several new chats in the last few minutes. Please wait a little, or reply in one of your open chats.'
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END $$;
