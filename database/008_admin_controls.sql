-- =====================================================================
-- NexusCX AI - Migration 008: administrator controls ("IT admin" tools)
-- Run AFTER 007_login_security.sql, once, in the Supabase SQL Editor.
--
-- 1. user_roles: a person can hold extra staff roles on top of their main
--    role (e.g. a Support Agent who also covers Knowledge Manager).
--    Permissions are the union of all their roles.
-- 2. users.must_change_password: set when an admin gives a temporary password.
-- 3. Admin functions (each checks manage_users, refuses self-harm and
--    removing the last administrator, and writes to the audit log):
--      admin_update_user, admin_set_roles, admin_set_status, admin_unlock,
--      admin_set_temp_password, admin_delete_user, admin_set_permission,
--      admin_user_overview
-- 4. clear_my_password_flag(): the user clears the flag after choosing a new password.
-- =====================================================================
BEGIN;

-- ---------- 1. extra roles ----------
CREATE TABLE public.user_roles (
    user_id    UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
    role       VARCHAR(20) NOT NULL CHECK (role IN
               ('support_agent','team_leader','knowledge_manager','business_specialist','administrator')),
    granted_by UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.user_roles TO authenticated;
CREATE POLICY "Users read own extra roles; staff read all" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = (SELECT private.my_user_id()) OR (SELECT private.has_permission('view_cases')));

-- Permissions now come from the main role PLUS any extra roles
CREATE OR REPLACE FUNCTION private.has_permission(p_permission text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    JOIN public.role_permissions rp
      ON rp.role = u.role
      OR rp.role IN (SELECT ur.role FROM public.user_roles ur WHERE ur.user_id = u.user_id)
    WHERE u.auth_user_id = (SELECT auth.uid()) AND u.status = 'active' AND rp.permission = p_permission)
$$;

-- Admins may switch permissions on and off for each role
GRANT INSERT, DELETE ON public.role_permissions TO authenticated;

-- ---------- 2. temporary passwords ----------
ALTER TABLE public.users ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT false;

-- ---------- 3. admin functions ----------
-- Shared guard: caller must be an active administrator (manage_users)
CREATE OR REPLACE FUNCTION private.require_admin() RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_me uuid := private.my_user_id();
BEGIN
  IF v_me IS NULL OR NOT private.has_permission('manage_users') THEN
    RAISE EXCEPTION 'Only administrators can do this' USING ERRCODE = '42501';
  END IF;
  RETURN v_me;
END $$;

CREATE OR REPLACE FUNCTION private.admin_count() RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT count(DISTINCT u.user_id)::int FROM public.users u
  WHERE u.status = 'active'
    AND (u.role = 'administrator'
         OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.user_id AND ur.role = 'administrator'))
$$;

CREATE OR REPLACE FUNCTION private.is_admin_user(p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE user_id = p_user_id AND role = 'administrator')
      OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user_id AND role = 'administrator')
$$;

CREATE OR REPLACE FUNCTION private.audit_admin(p_admin uuid, p_action text, p_target uuid, p_details jsonb, p_risk text DEFAULT 'medium')
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO public.audit_logs (user_id, actor, actor_type, action, entity_type, entity_id, result, risk_level, details)
  SELECT p_admin, u.name, 'human', p_action, 'users', p_target, 'success', p_risk, p_details
  FROM public.users u WHERE u.user_id = p_admin
$$;

-- Edit name and team
CREATE OR REPLACE FUNCTION public.admin_update_user(p_user_id uuid, p_name text, p_team_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_me uuid := private.require_admin();
BEGIN
  IF char_length(trim(COALESCE(p_name, ''))) < 2 THEN
    RAISE EXCEPTION 'Please enter a name of at least 2 characters' USING ERRCODE = '22023';
  END IF;
  UPDATE public.users SET name = left(trim(p_name), 100), team_id = p_team_id WHERE user_id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found' USING ERRCODE = '22023'; END IF;
  PERFORM private.audit_admin(v_me, 'user_updated', p_user_id, jsonb_build_object('name', p_name, 'team_id', p_team_id), 'low');
END $$;

-- Main role + extra staff roles
CREATE OR REPLACE FUNCTION public.admin_set_roles(p_user_id uuid, p_primary text, p_extra text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_me     uuid := private.require_admin();
  v_extra  text[] := ARRAY(SELECT DISTINCT r FROM unnest(COALESCE(p_extra, '{}')) r WHERE r <> p_primary);
  v_before text;
BEGIN
  SELECT role INTO v_before FROM public.users WHERE user_id = p_user_id;
  IF v_before IS NULL THEN RAISE EXCEPTION 'User not found' USING ERRCODE = '22023'; END IF;
  IF p_primary = 'customer' AND cardinality(v_extra) > 0 THEN
    RAISE EXCEPTION 'Customers cannot also hold staff roles' USING ERRCODE = '22023';
  END IF;
  IF cardinality(v_extra) > 2 THEN
    RAISE EXCEPTION 'A person can hold at most 2 extra roles' USING ERRCODE = '22023';
  END IF;
  IF p_user_id = v_me AND p_primary <> 'administrator' AND NOT ('administrator' = ANY (v_extra)) THEN
    RAISE EXCEPTION 'You cannot remove your own administrator role' USING ERRCODE = '22023';
  END IF;
  IF private.is_admin_user(p_user_id) AND p_primary <> 'administrator' AND NOT ('administrator' = ANY (v_extra))
     AND private.admin_count() <= 1 THEN
    RAISE EXCEPTION 'There must always be at least one administrator' USING ERRCODE = '22023';
  END IF;

  -- A customer becoming staff needs no customer profile change; staff becoming
  -- a customer needs one so they can open requests.
  IF p_primary = 'customer' AND NOT EXISTS (SELECT 1 FROM public.customers WHERE user_id = p_user_id) THEN
    INSERT INTO public.customers (user_id) VALUES (p_user_id);
  END IF;

  UPDATE public.users SET role = p_primary WHERE user_id = p_user_id;
  DELETE FROM public.user_roles WHERE user_id = p_user_id;
  INSERT INTO public.user_roles (user_id, role, granted_by) SELECT p_user_id, r, v_me FROM unnest(v_extra) r;
  PERFORM private.audit_admin(v_me, 'roles_changed', p_user_id,
    jsonb_build_object('from', v_before, 'to', p_primary, 'extra_roles', v_extra), 'high');
END $$;

-- Suspend or reactivate. Suspended users can still sign in to Supabase, but the
-- app signs them straight out and every RLS check (status = 'active') refuses them.
CREATE OR REPLACE FUNCTION public.admin_set_status(p_user_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_me uuid := private.require_admin();
BEGIN
  IF p_status NOT IN ('active', 'suspended') THEN RAISE EXCEPTION 'Unknown status' USING ERRCODE = '22023'; END IF;
  IF p_user_id = v_me AND p_status <> 'active' THEN
    RAISE EXCEPTION 'You cannot suspend your own account' USING ERRCODE = '22023';
  END IF;
  IF p_status = 'suspended' AND private.is_admin_user(p_user_id) AND private.admin_count() <= 1 THEN
    RAISE EXCEPTION 'There must always be at least one active administrator' USING ERRCODE = '22023';
  END IF;
  UPDATE public.users SET status = p_status, presence = CASE WHEN p_status = 'suspended' THEN 'offline' ELSE presence END
  WHERE user_id = p_user_id AND status <> 'deleted';
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found' USING ERRCODE = '22023'; END IF;
  PERFORM private.audit_admin(v_me, CASE WHEN p_status = 'suspended' THEN 'user_suspended' ELSE 'user_reactivated' END,
                              p_user_id, NULL, 'high');
END $$;

-- Clear failed sign-in attempts so a locked account can try again at once
CREATE OR REPLACE FUNCTION public.admin_unlock(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_me uuid := private.require_admin(); v_email text;
BEGIN
  SELECT email INTO v_email FROM public.users WHERE user_id = p_user_id;
  IF v_email IS NULL THEN RAISE EXCEPTION 'User not found' USING ERRCODE = '22023'; END IF;
  DELETE FROM public.login_attempts WHERE email_hash = private.email_hash(v_email) AND NOT success;
  PERFORM private.audit_admin(v_me, 'account_unlocked', p_user_id, NULL, 'medium');
END $$;

-- Give a temporary password. It is hashed with bcrypt (same as Supabase Auth);
-- the person must choose a new one at their next sign-in.
CREATE OR REPLACE FUNCTION public.admin_set_temp_password(p_user_id uuid, p_password text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_me uuid := private.require_admin(); v_auth uuid;
BEGIN
  IF p_password IS NULL OR char_length(p_password) < 8 OR p_password !~ '[A-Za-z]' OR p_password !~ '[0-9]' THEN
    RAISE EXCEPTION 'Temporary password must be at least 8 characters with letters and numbers' USING ERRCODE = '22023';
  END IF;
  SELECT auth_user_id INTO v_auth FROM public.users WHERE user_id = p_user_id;
  IF v_auth IS NULL THEN
    RAISE EXCEPTION 'This person has no login yet. Create one in Supabase first.' USING ERRCODE = '22023';
  END IF;
  UPDATE auth.users SET encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
                        updated_at = now()
  WHERE id = v_auth;
  UPDATE public.users SET must_change_password = (p_user_id <> v_me) WHERE user_id = p_user_id;
  DELETE FROM public.login_attempts WHERE email_hash = private.email_hash((SELECT email FROM public.users WHERE user_id = p_user_id)) AND NOT success;
  PERFORM private.audit_admin(v_me, 'password_reset_by_admin', p_user_id, NULL, 'high');
END $$;

-- Delete. People with case history are anonymised (their cases must still make
-- sense); people with no history are removed completely. Their login is always deleted.
CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_me      uuid := private.require_admin();
  v_auth    uuid;
  v_name    text;
  v_history boolean;
  v_short   text := substr(md5(p_user_id::text), 1, 10);
BEGIN
  IF p_user_id = v_me THEN RAISE EXCEPTION 'You cannot delete your own account' USING ERRCODE = '22023'; END IF;
  IF private.is_admin_user(p_user_id) AND private.admin_count() <= 1 THEN
    RAISE EXCEPTION 'There must always be at least one administrator' USING ERRCODE = '22023';
  END IF;
  SELECT auth_user_id, name INTO v_auth, v_name FROM public.users WHERE user_id = p_user_id AND status <> 'deleted';
  IF v_name IS NULL THEN RAISE EXCEPTION 'User not found' USING ERRCODE = '22023'; END IF;

  v_history := EXISTS (SELECT 1 FROM public.cases c JOIN public.customers cu ON cu.customer_id = c.customer_id WHERE cu.user_id = p_user_id)
            OR EXISTS (SELECT 1 FROM public.case_assignments WHERE user_id = p_user_id)
            OR EXISTS (SELECT 1 FROM public.agent_builder_requests WHERE user_id = p_user_id)
            OR EXISTS (SELECT 1 FROM public.agent_config_versions WHERE created_by_user_id = p_user_id);

  PERFORM private.audit_admin(v_me, 'user_deleted', p_user_id,
    jsonb_build_object('name', v_name, 'mode', CASE WHEN v_history THEN 'anonymised' ELSE 'removed' END), 'high');

  IF v_history THEN
    UPDATE public.users
    SET name = 'Deleted user', email = 'deleted+' || v_short || '@nexuscx.invalid', username = 'deleted_' || v_short,
        status = 'deleted', presence = 'offline', auth_user_id = NULL, team_id = NULL
    WHERE user_id = p_user_id;
    UPDATE public.customers SET phone = NULL, address = NULL, date_of_birth = NULL WHERE user_id = p_user_id;
    DELETE FROM public.user_roles WHERE user_id = p_user_id;
    DELETE FROM public.notifications WHERE user_id = p_user_id;
  ELSE
    DELETE FROM public.customers WHERE user_id = p_user_id;
    DELETE FROM public.users WHERE user_id = p_user_id;
  END IF;
  IF v_auth IS NOT NULL THEN DELETE FROM auth.users WHERE id = v_auth; END IF;
  RETURN CASE WHEN v_history THEN 'anonymised' ELSE 'removed' END;
END $$;

-- Switch one permission on or off for a role
CREATE OR REPLACE FUNCTION public.admin_set_permission(p_role text, p_permission text, p_granted boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_me uuid := private.require_admin();
BEGIN
  IF p_role = 'administrator' AND p_permission = 'manage_users' AND NOT p_granted THEN
    RAISE EXCEPTION 'Administrators must keep Manage users, or nobody could manage accounts' USING ERRCODE = '22023';
  END IF;
  IF p_role = 'customer' THEN
    RAISE EXCEPTION 'Customer access is fixed and cannot be changed here' USING ERRCODE = '22023';
  END IF;
  IF p_granted THEN
    INSERT INTO public.role_permissions (role, permission) VALUES (p_role, p_permission) ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.role_permissions WHERE role = p_role AND permission = p_permission;
  END IF;
  PERFORM private.audit_admin(v_me, CASE WHEN p_granted THEN 'permission_granted' ELSE 'permission_removed' END, NULL,
    jsonb_build_object('role', p_role, 'permission', p_permission), 'high');
END $$;

-- Everything the admin "user detail" page needs, in one call
CREATE OR REPLACE FUNCTION public.admin_user_overview(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_me uuid := private.require_admin(); v jsonb;
BEGIN
  SELECT jsonb_build_object(
    'user_id', u.user_id, 'name', u.name, 'username', u.username, 'email', u.email, 'role', u.role,
    'status', u.status, 'presence', u.presence, 'team_id', u.team_id, 'created_at', u.created_at,
    'has_login', u.auth_user_id IS NOT NULL, 'must_change_password', u.must_change_password,
    'last_sign_in_at', a.last_sign_in_at, 'last_active_at', u.last_active_at,
    'extra_roles', COALESCE((SELECT jsonb_agg(ur.role ORDER BY ur.role) FROM public.user_roles ur WHERE ur.user_id = u.user_id), '[]'),
    'locked_seconds', public.login_lock_status(u.email),
    'is_self', u.user_id = v_me,
    'case_count', (SELECT count(*) FROM public.cases c JOIN public.customers cu ON cu.customer_id = c.customer_id WHERE cu.user_id = u.user_id),
    'activity', COALESCE((SELECT jsonb_agg(x ORDER BY x->>'at' DESC) FROM (
        SELECT jsonb_build_object('at', l.created_at, 'actor', l.actor, 'action', l.action, 'result', l.result) AS x
        FROM public.audit_logs l
        WHERE l.entity_type = 'users' AND l.entity_id = u.user_id OR l.user_id = u.user_id
        ORDER BY l.created_at DESC LIMIT 12) s), '[]'))
  INTO v
  FROM public.users u LEFT JOIN auth.users a ON a.id = u.auth_user_id
  WHERE u.user_id = p_user_id;
  RETURN v;
END $$;

-- ---------- 4. user clears their own "must change password" flag ----------
CREATE OR REPLACE FUNCTION public.clear_my_password_flag()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  UPDATE public.users SET must_change_password = false WHERE auth_user_id = (SELECT auth.uid())
$$;

-- ---------- permissions on the new functions ----------
REVOKE EXECUTE ON FUNCTION private.require_admin(), private.admin_count(), private.is_admin_user(uuid),
  private.audit_admin(uuid, text, uuid, jsonb, text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION
  public.admin_update_user(uuid, text, uuid), public.admin_set_roles(uuid, text, text[]),
  public.admin_set_status(uuid, text), public.admin_unlock(uuid), public.admin_set_temp_password(uuid, text),
  public.admin_delete_user(uuid), public.admin_set_permission(text, text, boolean),
  public.admin_user_overview(uuid), public.clear_my_password_flag() FROM public, anon;
GRANT EXECUTE ON FUNCTION
  public.admin_update_user(uuid, text, uuid), public.admin_set_roles(uuid, text, text[]),
  public.admin_set_status(uuid, text), public.admin_unlock(uuid), public.admin_set_temp_password(uuid, text),
  public.admin_delete_user(uuid), public.admin_set_permission(text, text, boolean),
  public.admin_user_overview(uuid), public.clear_my_password_flag() TO authenticated;

-- Hide deleted people from normal lists
CREATE OR REPLACE VIEW public.v_people WITH (security_invoker = true) AS
SELECT u.user_id, u.name, u.username, u.email, u.role, u.status, u.presence, u.last_active_at,
       u.must_change_password, u.auth_user_id IS NOT NULL AS has_login, t.name AS team,
       COALESCE((SELECT array_agg(ur.role ORDER BY ur.role) FROM public.user_roles ur WHERE ur.user_id = u.user_id), '{}') AS extra_roles
FROM public.users u LEFT JOIN public.teams t ON t.team_id = u.team_id
WHERE u.status <> 'deleted';
GRANT SELECT ON public.v_people TO authenticated;

COMMIT;

SELECT 'migration 008 ok' AS result,
       (SELECT count(*) FROM pg_proc WHERE proname LIKE 'admin\_%') AS admin_functions;
