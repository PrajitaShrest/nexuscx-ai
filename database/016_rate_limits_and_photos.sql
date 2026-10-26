-- =====================================================================
-- 016  Message limits, return photos and live updates   (Week 8)
-- Run after 015.
--
-- 1. Rate limits, enforced in the database so they also apply if someone
--    calls the API directly:
--      * a customer can open at most 5 new requests in 10 minutes
--      * a customer can send at most 10 chat messages in 1 minute
--    Staff and the AI are not limited.
-- 2. Return photos: a private Storage bucket "return-photos".
--      * customers upload into a folder named after their own user id
--      * customers see only their own photos; staff (view_cases) see all
--      * images only (JPEG, PNG, WebP, HEIC), at most 5 MB each
--    return_requests.photos keeps the list of file paths.
-- =====================================================================

-- ---------- 1. rate limits ----------
CREATE OR REPLACE FUNCTION private.limit_new_cases() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF private.my_customer_id() IS NOT NULL AND NEW.customer_id = private.my_customer_id()
     AND (SELECT count(*) FROM public.cases c
          WHERE c.customer_id = NEW.customer_id AND c.created_at > now() - interval '10 minutes') >= 5 THEN
    RAISE EXCEPTION 'You have sent several new requests in the last few minutes. Please wait a little, or reply in one of your open chats.'
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_limit_new_cases ON public.cases;
CREATE TRIGGER trg_limit_new_cases BEFORE INSERT ON public.cases
FOR EACH ROW EXECUTE FUNCTION private.limit_new_cases();

CREATE OR REPLACE FUNCTION private.limit_customer_messages() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.sender_type = 'customer'
     AND (SELECT count(*) FROM public.messages m
          WHERE m.sender_type = 'customer' AND m.sender_id = NEW.sender_id AND m.sent_at > now() - interval '1 minute') >= 10 THEN
    RAISE EXCEPTION 'You are sending messages very quickly. Please wait a minute and try again.' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_limit_customer_messages ON public.messages;
CREATE TRIGGER trg_limit_customer_messages BEFORE INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION private.limit_customer_messages();

CREATE INDEX IF NOT EXISTS idx_cases_customer_created ON public.cases(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender_sent ON public.messages(sender_id, sent_at DESC);

-- ---------- 2. return photos ----------
ALTER TABLE public.return_requests ADD COLUMN IF NOT EXISTS photos text[] NOT NULL DEFAULT '{}';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('return-photos', 'return-photos', false, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/heic'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Customers upload own return photos" ON storage.objects;
CREATE POLICY "Customers upload own return photos" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'return-photos' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

DROP POLICY IF EXISTS "Owners and staff see return photos" ON storage.objects;
CREATE POLICY "Owners and staff see return photos" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'return-photos'
       AND ((storage.foldername(name))[1] = (SELECT auth.uid())::text OR (SELECT private.has_permission('view_cases'))));

-- Links uploaded photos to a return the customer just made (max 3, own folder, still "requested").
CREATE OR REPLACE FUNCTION public.attach_return_photos(p_return uuid, p_paths text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_cust uuid := private.require_customer();
  v_r    public.return_requests;
  v_path text;
BEGIN
  SELECT * INTO v_r FROM public.return_requests WHERE return_id = p_return AND customer_id = v_cust FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That return request could not be found.' USING ERRCODE = '22023'; END IF;
  IF v_r.status <> 'requested' THEN RAISE EXCEPTION 'Photos can only be added while the request is waiting for review.' USING ERRCODE = '22023'; END IF;
  IF coalesce(array_length(p_paths, 1), 0) + coalesce(array_length(v_r.photos, 1), 0) > 3 THEN
    RAISE EXCEPTION 'You can add up to 3 photos.' USING ERRCODE = '22023';
  END IF;
  FOREACH v_path IN ARRAY coalesce(p_paths, '{}') LOOP
    IF v_path !~ ('^' || (SELECT auth.uid())::text || '/[A-Za-z0-9-]+\.(jpg|jpeg|png|webp|heic)$')
       OR NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'return-photos' AND o.name = v_path) THEN
      RAISE EXCEPTION 'One of the photos did not upload correctly. Please try again.' USING ERRCODE = '22023';
    END IF;
  END LOOP;
  UPDATE public.return_requests SET photos = photos || p_paths, updated_at = now() WHERE return_id = p_return;
END $$;
REVOKE ALL ON FUNCTION public.attach_return_photos(uuid, text[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.attach_return_photos(uuid, text[]) TO authenticated;

-- ---------- 3. live updates ----------
-- Supabase Realtime sends row changes to signed-in users who are allowed to see them
-- (Row Level Security applies). Add the tables the app listens to.
DO $$
DECLARE t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['messages','cases','notifications','return_requests'] LOOP
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END $$;
