-- =====================================================================
-- 012  Knowledge Base editing + staff Customers list   (Week 7)
-- Run after 011. Safe to run once.
--
-- Knowledge articles are what the AI answers from. Rules:
--   * only people with manage_knowledge can add, edit or change status
--   * new and edited articles start as drafts; the AI only uses "approved"
--   * editing an approved article sends it back to "under_review" with a new
--     version, so nothing reaches customers without a second look
--   * every change is written to audit_logs
-- =====================================================================

-- Who wrote the article (so we can show it and stop people approving their own work)
ALTER TABLE public.knowledge_documents ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.users(user_id) ON DELETE SET NULL;
ALTER TABLE public.knowledge_documents ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.users(user_id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION private.require_knowledge() RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.has_permission('manage_knowledge') THEN
    RAISE EXCEPTION 'You do not have permission to manage the knowledge base.' USING ERRCODE = '42501';
  END IF;
  RETURN private.my_user_id();
END $$;

CREATE OR REPLACE FUNCTION private.log_knowledge(p_user uuid, p_action text, p_doc uuid, p_details jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO public.audit_logs (user_id, actor, actor_type, action, entity_type, entity_id, result, risk_level, details)
  SELECT p_user, u.name, 'human', p_action, 'knowledge_documents', p_doc, 'success', 'low', p_details
  FROM public.users u WHERE u.user_id = p_user
$$;

-- Add a new article or edit one. Returns the document id.
CREATE OR REPLACE FUNCTION public.save_knowledge_doc(
  p_id uuid, p_title text, p_category text, p_content text, p_keywords text DEFAULT '')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := private.require_knowledge();
  v_doc  public.knowledge_documents;
  v_id   uuid;
  v_ver  text;
BEGIN
  p_title := btrim(coalesce(p_title, '')); p_content := btrim(coalesce(p_content, ''));
  IF length(p_title) < 5 OR length(p_title) > 150 THEN
    RAISE EXCEPTION 'Give the article a title of 5 to 150 characters.' USING ERRCODE = '22023';
  END IF;
  IF p_category NOT IN ('orders','billing','technical','account','general') THEN
    RAISE EXCEPTION 'Please choose a category.' USING ERRCODE = '22023';
  END IF;
  IF length(p_content) < 30 OR length(p_content) > 8000 THEN
    RAISE EXCEPTION 'The answer must be 30 to 8000 characters.' USING ERRCODE = '22023';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.knowledge_documents (title, category, content, keywords, status, version, owner, source, created_by, updated_by)
    SELECT p_title, p_category, p_content, lower(btrim(coalesce(p_keywords, ''))), 'draft', 'v1.0', 'Knowledge Team', 'Knowledge Base editor', v_user, v_user
    RETURNING document_id INTO v_id;
    PERFORM private.log_knowledge(v_user, 'knowledge_created', v_id, jsonb_build_object('title', p_title));
    RETURN v_id;
  END IF;

  SELECT * INTO v_doc FROM public.knowledge_documents WHERE document_id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That article no longer exists.' USING ERRCODE = '22023'; END IF;

  -- A changed approved article gets a new minor version and goes back for review.
  v_ver := v_doc.version;
  IF v_doc.status = 'approved' THEN
    v_ver := 'v' || coalesce((regexp_match(v_doc.version, '^v(\d+)'))[1], '1') || '.'
             || (coalesce((regexp_match(v_doc.version, '\.(\d+)$'))[1]::int, 0) + 1);
  END IF;

  UPDATE public.knowledge_documents SET
    title = p_title, category = p_category, content = p_content,
    keywords = lower(btrim(coalesce(p_keywords, ''))),
    status = CASE WHEN status = 'approved' THEN 'under_review' ELSE status END,
    approved_by = CASE WHEN status = 'approved' THEN NULL ELSE approved_by END,
    approved_at = CASE WHEN status = 'approved' THEN NULL ELSE approved_at END,
    version = v_ver, updated_by = v_user, updated_at = now()
  WHERE document_id = p_id;
  PERFORM private.log_knowledge(v_user, 'knowledge_edited', p_id,
    jsonb_build_object('title', p_title, 'from_status', v_doc.status, 'version', v_ver));
  RETURN p_id;
END $$;

-- Move an article through its life: draft -> under_review -> approved -> disabled/archived.
CREATE OR REPLACE FUNCTION public.set_knowledge_status(p_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := private.require_knowledge();
  v_doc  public.knowledge_documents;
BEGIN
  SELECT * INTO v_doc FROM public.knowledge_documents WHERE document_id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That article no longer exists.' USING ERRCODE = '22023'; END IF;
  IF p_status = v_doc.status THEN RETURN; END IF;

  IF NOT (
       (v_doc.status = 'draft'        AND p_status IN ('under_review','archived'))
    OR (v_doc.status = 'under_review' AND p_status IN ('approved','draft','archived'))
    OR (v_doc.status = 'approved'     AND p_status IN ('disabled','archived'))
    OR (v_doc.status = 'disabled'     AND p_status IN ('approved','archived'))
    OR (v_doc.status = 'archived'     AND p_status = 'draft')
  ) THEN
    RAISE EXCEPTION 'An article that is % cannot be moved to %.', replace(v_doc.status, '_', ' '), replace(p_status, '_', ' ')
      USING ERRCODE = '22023';
  END IF;

  -- Four-eyes rule: you cannot approve an article you wrote or last edited.
  IF p_status = 'approved' AND v_doc.status = 'under_review'
     AND v_user IN (coalesce(v_doc.created_by, '00000000-0000-0000-0000-000000000000'), coalesce(v_doc.updated_by, '00000000-0000-0000-0000-000000000000'))
     AND NOT private.has_permission('manage_users') THEN
    RAISE EXCEPTION 'Someone else must approve an article you wrote or edited.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.knowledge_documents SET
    status = p_status,
    approved_by = CASE WHEN p_status = 'approved' THEN v_user ELSE approved_by END,
    approved_at = CASE WHEN p_status = 'approved' THEN now() ELSE approved_at END,
    updated_at = now()
  WHERE document_id = p_id;
  PERFORM private.log_knowledge(v_user, 'knowledge_' || p_status, p_id,
    jsonb_build_object('title', v_doc.title, 'from_status', v_doc.status));
END $$;

REVOKE ALL ON FUNCTION public.save_knowledge_doc(uuid, text, text, text, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.set_knowledge_status(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.save_knowledge_doc(uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_knowledge_status(uuid, text) TO authenticated;

-- How often each approved article has been used as an answer source (last 30 days).
CREATE OR REPLACE VIEW public.v_knowledge_usage WITH (security_invoker = true) AS
SELECT d.document_id, d.title, d.category, d.status, d.version, d.keywords, d.updated_at, d.approved_at,
       cu.name AS created_by_name, uu.name AS updated_by_name, au.name AS approved_by_name,
       (SELECT count(*) FROM public.knowledge_retrievals k
         WHERE k.document_id = d.document_id AND k.retrieved_at > now() - interval '30 days') AS uses_30d
FROM public.knowledge_documents d
LEFT JOIN public.users cu ON cu.user_id = d.created_by
LEFT JOIN public.users uu ON uu.user_id = d.updated_by
LEFT JOIN public.users au ON au.user_id = d.approved_by;
GRANT SELECT ON public.v_knowledge_usage TO authenticated;

-- Staff Customers list: one row per customer with their activity.
-- security_invoker means Row Level Security on customers/cases/orders still applies.
CREATE OR REPLACE VIEW public.v_customer_overview WITH (security_invoker = true) AS
SELECT c.customer_id, u.user_id, u.name, u.email, c.phone, c.tier, c.created_at,
       u.last_active_at,
       (SELECT count(*) FROM public.orders o WHERE o.customer_id = c.customer_id)                      AS orders,
       (SELECT coalesce(sum(o.total_cents), 0) FROM public.orders o
         WHERE o.customer_id = c.customer_id AND o.status <> 'cancelled')                              AS spent_cents,
       (SELECT count(*) FROM public.cases k WHERE k.customer_id = c.customer_id)                       AS cases,
       (SELECT count(*) FROM public.cases k WHERE k.customer_id = c.customer_id
         AND k.status NOT IN ('resolved','closed'))                                                    AS open_cases,
       (SELECT count(*) FROM public.return_requests r WHERE r.customer_id = c.customer_id)                                                          AS returns,
       (SELECT round(avg(f.rating), 1) FROM public.feedback f JOIN public.cases k ON k.case_id = f.case_id
         WHERE k.customer_id = c.customer_id)                                                          AS avg_rating,
       greatest((SELECT max(k.updated_at) FROM public.cases k WHERE k.customer_id = c.customer_id),
                (SELECT max(o.created_at) FROM public.orders o WHERE o.customer_id = c.customer_id))  AS last_activity
FROM public.customers c
JOIN public.users u ON u.user_id = c.user_id;
GRANT SELECT ON public.v_customer_overview TO authenticated;
