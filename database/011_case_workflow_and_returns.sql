-- =====================================================================
-- NexusCX AI - Migration 011: staff case workflow, returns & exchanges
-- Run AFTER 010_customer_portal.sql, once, in the Supabase SQL Editor.
--
-- Staff (with resolve_cases) can now work an escalated case end to end:
--   staff_take_case   - "Take over": assign to me, status Human Handling
--   staff_reply       - chat with the customer (customer sees it straight away)
--   staff_set_status  - Waiting for customer / Resolved / Closed / reopen
--   staff_add_note    - internal note, never shown to the customer
-- Customers can:
--   request_return    - return or exchange items from a delivered order
--                       (within 30 days); opens a case for staff
--   rate_case         - rate a resolved chat 1-5 (feeds CSAT)
--   mark_notifications_read
-- Staff handle returns with staff_update_return (approve, reject, received, completed).
-- Notifications now also go to customers (staff replies, order and return updates).
-- =====================================================================
BEGIN;

-- ---------- notifications: new types, customers receive them too ----------
ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN
  ('new_escalation','sla_breach','low_confidence','case_assigned','agent_approval',
   'customer_reply','staff_reply','case_update','order_update','return_request','return_update'));
ALTER TABLE public.notifications ADD COLUMN link VARCHAR(200);

-- ---------- internal notes (staff only) ----------
CREATE TABLE public.case_notes (
    note_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id    UUID NOT NULL REFERENCES public.cases(case_id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES public.users(user_id) ON DELETE RESTRICT,
    content    VARCHAR(1000) NOT NULL CHECK (char_length(content) >= 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_case_notes_case ON public.case_notes (case_id, created_at);
ALTER TABLE public.case_notes ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.case_notes TO authenticated;
CREATE POLICY "Staff read case notes" ON public.case_notes FOR SELECT TO authenticated
  USING ((SELECT private.has_permission('view_cases')));

-- ---------- returns and exchanges ----------
CREATE SEQUENCE public.return_number_seq START 501;
CREATE TABLE public.return_requests (
    return_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_number VARCHAR(12) NOT NULL UNIQUE DEFAULT ('RT-' || nextval('public.return_number_seq')),
    order_id      UUID NOT NULL REFERENCES public.orders(order_id) ON DELETE RESTRICT,
    customer_id   UUID NOT NULL REFERENCES public.customers(customer_id) ON DELETE RESTRICT,
    case_id       UUID REFERENCES public.cases(case_id) ON DELETE SET NULL,
    kind          VARCHAR(10) NOT NULL CHECK (kind IN ('return','exchange')),
    reason        VARCHAR(20) NOT NULL CHECK (reason IN ('damaged','wrong_item','wrong_size','not_as_described','changed_mind','faulty')),
    details       VARCHAR(500),
    status        VARCHAR(12) NOT NULL DEFAULT 'requested'
                  CHECK (status IN ('requested','approved','rejected','received','completed')),
    refund_cents  INTEGER NOT NULL DEFAULT 0 CHECK (refund_cents >= 0),
    staff_note    VARCHAR(300),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_returns_customer ON public.return_requests (customer_id, created_at DESC);
CREATE INDEX idx_returns_status ON public.return_requests (status);

CREATE TABLE public.return_items (
    return_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_id      UUID NOT NULL REFERENCES public.return_requests(return_id) ON DELETE CASCADE,
    order_item_id  UUID NOT NULL REFERENCES public.order_items(order_item_id) ON DELETE RESTRICT,
    product_name   VARCHAR(100) NOT NULL,
    quantity       INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 10),
    exchange_for   VARCHAR(100)          -- e.g. "Size M" or "Black" for exchanges
);
CREATE INDEX idx_return_items_return ON public.return_items (return_id);

ALTER TABLE public.return_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_items    ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.return_requests, public.return_items TO authenticated;
CREATE POLICY "Customers see own returns; staff see all" ON public.return_requests FOR SELECT TO authenticated
  USING (customer_id = (SELECT private.my_customer_id()) OR (SELECT private.has_permission('view_cases')));
CREATE POLICY "Items of visible returns" ON public.return_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.return_requests r WHERE r.return_id = return_items.return_id));

-- ---------- helpers ----------
CREATE OR REPLACE FUNCTION private.require_agent() RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v uuid := private.my_user_id();
BEGIN
  IF v IS NULL OR NOT private.has_permission('resolve_cases') THEN
    RAISE EXCEPTION 'Only staff who can resolve cases can do this' USING ERRCODE = '42501';
  END IF;
  RETURN v;
END $$;

-- The customer's user id for a case (for notifications)
CREATE OR REPLACE FUNCTION private.case_customer_user(p_case_id uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT cu.user_id FROM public.cases c JOIN public.customers cu ON cu.customer_id = c.customer_id WHERE c.case_id = p_case_id
$$;

CREATE OR REPLACE FUNCTION private.case_conversation(p_case_id uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT conversation_id FROM public.conversations WHERE case_id = p_case_id ORDER BY started_at LIMIT 1
$$;

-- ---------- staff: take over a case ----------
CREATE OR REPLACE FUNCTION public.staff_take_case(p_case_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_me uuid := private.require_agent(); v_name text; v_case record;
BEGIN
  SELECT case_id, case_number, status INTO v_case FROM public.cases WHERE case_id = p_case_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Case not found' USING ERRCODE = '22023'; END IF;
  IF v_case.status = 'closed' THEN RAISE EXCEPTION 'This case is closed. Reopen it first.' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM public.case_assignments WHERE case_id = p_case_id AND user_id = v_me AND status = 'active') THEN RETURN; END IF;
  SELECT split_part(name, ' ', 1) INTO v_name FROM public.users WHERE user_id = v_me;

  UPDATE public.case_assignments SET status = 'reassigned' WHERE case_id = p_case_id AND status = 'active';
  INSERT INTO public.case_assignments (case_id, user_id) VALUES (p_case_id, v_me);
  UPDATE public.cases SET status = 'human_handling', assigned_agent_id = NULL, updated_at = now() WHERE case_id = p_case_id;
  UPDATE public.escalations SET status = 'accepted' WHERE case_id = p_case_id AND status = 'pending';
  INSERT INTO public.messages (conversation_id, sender_type, sender_id, content, message_type)
  VALUES (private.case_conversation(p_case_id), 'system', NULL, v_name || ' from our support team has joined the chat.', 'system_notice');
  INSERT INTO public.notifications (user_id, type, title, case_id, link)
  VALUES (private.case_customer_user(p_case_id), 'case_update', left(v_case.case_number || ': a support specialist joined your chat', 120),
          p_case_id, '/account/chats/' || p_case_id);
  INSERT INTO public.audit_logs (user_id, actor, actor_type, action, entity_type, entity_id, case_id, result, risk_level)
  SELECT v_me, u.name, 'human', 'case_taken', 'cases', p_case_id, p_case_id, 'success', 'low' FROM public.users u WHERE u.user_id = v_me;
END $$;

-- ---------- staff: reply to the customer ----------
CREATE OR REPLACE FUNCTION public.staff_reply(p_case_id uuid, p_message text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_me uuid := private.require_agent(); v_text text := trim(COALESCE(p_message,'')); v_case record;
BEGIN
  SELECT case_id, case_number, status, first_response_at INTO v_case FROM public.cases WHERE case_id = p_case_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Case not found' USING ERRCODE = '22023'; END IF;
  IF v_case.status = 'closed' THEN RAISE EXCEPTION 'This case is closed. Reopen it first.' USING ERRCODE = '22023'; END IF;
  IF char_length(v_text) < 2 OR char_length(v_text) > 2000 THEN
    RAISE EXCEPTION 'Please write between 2 and 2000 characters' USING ERRCODE = '22023';
  END IF;
  -- Replying takes the case if nobody has it yet
  IF NOT EXISTS (SELECT 1 FROM public.case_assignments WHERE case_id = p_case_id AND status = 'active') THEN
    PERFORM public.staff_take_case(p_case_id);
  END IF;
  INSERT INTO public.messages (conversation_id, sender_type, sender_id, content)
  VALUES (private.case_conversation(p_case_id), 'human_agent', v_me, v_text);
  UPDATE public.cases SET status = CASE WHEN status IN ('escalated','ai_handling','resolved') THEN 'human_handling' ELSE status END,
         first_response_at = COALESCE(first_response_at, now()), updated_at = now()
  WHERE case_id = p_case_id;
  INSERT INTO public.notifications (user_id, type, title, case_id, link)
  VALUES (private.case_customer_user(p_case_id), 'staff_reply', left(v_case.case_number || ': our team replied to you', 120),
          p_case_id, '/account/chats/' || p_case_id);
  INSERT INTO public.audit_logs (user_id, actor, actor_type, action, entity_type, entity_id, case_id, result, risk_level)
  SELECT v_me, u.name, 'human', 'staff_replied', 'cases', p_case_id, p_case_id, 'success', 'low' FROM public.users u WHERE u.user_id = v_me;
END $$;

-- ---------- staff: change status ----------
-- human_handling (reopen / back to work), waiting (for the customer), resolved, closed
CREATE OR REPLACE FUNCTION public.staff_set_status(p_case_id uuid, p_status text, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_me uuid := private.require_agent(); v_case record; v_msg text;
BEGIN
  IF p_status NOT IN ('human_handling','waiting','resolved','closed') THEN
    RAISE EXCEPTION 'Unknown status' USING ERRCODE = '22023';
  END IF;
  SELECT case_id, case_number, status INTO v_case FROM public.cases WHERE case_id = p_case_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Case not found' USING ERRCODE = '22023'; END IF;
  IF v_case.status = p_status THEN RETURN; END IF;

  UPDATE public.cases SET status = p_status, updated_at = now(),
         closed_at = CASE WHEN p_status = 'closed' THEN now() WHEN p_status = 'human_handling' THEN NULL ELSE closed_at END
  WHERE case_id = p_case_id;
  IF p_status IN ('resolved','closed') THEN
    UPDATE public.escalations SET status = 'resolved' WHERE case_id = p_case_id AND status <> 'resolved';
  END IF;
  IF p_status = 'closed' THEN
    UPDATE public.case_assignments SET status = 'completed' WHERE case_id = p_case_id AND status = 'active';
  END IF;
  IF p_status = 'human_handling' AND NOT EXISTS (SELECT 1 FROM public.case_assignments WHERE case_id = p_case_id AND status = 'active') THEN
    INSERT INTO public.case_assignments (case_id, user_id) VALUES (p_case_id, v_me);
  END IF;

  v_msg := CASE p_status
    WHEN 'waiting'  THEN 'We are waiting for your reply. Just answer here when you are ready.'
    WHEN 'resolved' THEN 'We have marked this as resolved.' || COALESCE(' ' || NULLIF(trim(p_note),''), '') || ' If anything is still wrong, reply here and we will reopen it.'
    WHEN 'closed'   THEN 'This conversation is now closed.' || COALESCE(' ' || NULLIF(trim(p_note),''), '') || ' Start a new chat any time.'
    ELSE 'Your case has been reopened and a specialist is looking at it.' END;
  INSERT INTO public.messages (conversation_id, sender_type, sender_id, content, message_type)
  VALUES (private.case_conversation(p_case_id), 'system', NULL, left(v_msg, 2000), 'system_notice');
  INSERT INTO public.notifications (user_id, type, title, case_id, link)
  VALUES (private.case_customer_user(p_case_id), 'case_update',
          left(v_case.case_number || CASE p_status WHEN 'waiting' THEN ': we need your reply' WHEN 'resolved' THEN ': resolved'
                                                   WHEN 'closed' THEN ': closed' ELSE ': reopened' END, 120),
          p_case_id, '/account/chats/' || p_case_id);
  INSERT INTO public.audit_logs (user_id, actor, actor_type, action, entity_type, entity_id, case_id, result, risk_level, details)
  SELECT v_me, u.name, 'human', 'case_status_changed', 'cases', p_case_id, p_case_id, 'success', 'low',
         jsonb_build_object('from', v_case.status, 'to', p_status) FROM public.users u WHERE u.user_id = v_me;
END $$;

-- ---------- staff: internal note ----------
CREATE OR REPLACE FUNCTION public.staff_add_note(p_case_id uuid, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_me uuid := private.require_agent();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.cases WHERE case_id = p_case_id) THEN RAISE EXCEPTION 'Case not found' USING ERRCODE = '22023'; END IF;
  IF char_length(trim(COALESCE(p_note,''))) < 2 OR char_length(p_note) > 1000 THEN
    RAISE EXCEPTION 'Notes must be 2 to 1000 characters' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.case_notes (case_id, user_id, content) VALUES (p_case_id, v_me, trim(p_note));
END $$;

-- ---------- customer follow-up (replaces the 010 version) ----------
-- If a staff member has the case, it stays with them and only they are told.
CREATE OR REPLACE FUNCTION public.customer_reply(p_case_id uuid, p_message text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_cust uuid := private.require_customer();
  v_text text := trim(COALESCE(p_message,''));
  v_case record;
  v_agent uuid;
BEGIN
  SELECT case_id, case_number, status INTO v_case FROM public.cases WHERE case_id = p_case_id AND customer_id = v_cust FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conversation not found' USING ERRCODE = '22023'; END IF;
  IF v_case.status = 'closed' THEN RAISE EXCEPTION 'This conversation is closed. Please start a new one.' USING ERRCODE = '22023'; END IF;
  IF char_length(v_text) < 2 OR char_length(v_text) > 2000 THEN
    RAISE EXCEPTION 'Please write between 2 and 2000 characters' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.messages (conversation_id, sender_type, sender_id, content)
  VALUES (private.case_conversation(p_case_id), 'customer', private.my_user_id(), v_text);

  SELECT user_id INTO v_agent FROM public.case_assignments WHERE case_id = p_case_id AND status = 'active' ORDER BY assigned_at DESC LIMIT 1;
  IF v_agent IS NOT NULL THEN
    UPDATE public.cases SET status = 'human_handling', updated_at = now() WHERE case_id = p_case_id;
    INSERT INTO public.notifications (user_id, type, title, case_id, link)
    VALUES (v_agent, 'customer_reply', left(v_case.case_number || ': customer replied', 120), p_case_id, '/cases/' || p_case_id);
  ELSE
    UPDATE public.cases SET status = 'escalated', updated_at = now() WHERE case_id = p_case_id;
    INSERT INTO public.notifications (user_id, type, title, case_id, link)
    SELECT u.user_id, 'customer_reply', left(v_case.case_number || ': customer replied', 120), p_case_id, '/cases/' || p_case_id
    FROM public.users u WHERE u.role IN ('support_agent','team_leader') AND u.status = 'active';
  END IF;
  INSERT INTO public.audit_logs (user_id, actor, actor_type, action, entity_type, entity_id, case_id, result, risk_level)
  VALUES (private.my_user_id(), 'Customer', 'human', 'customer_replied', 'cases', p_case_id, p_case_id, 'success', 'low');
END $$;

-- ---------- customer: return or exchange ----------
-- p_items = [{"order_item_id":"…","quantity":1,"exchange_for":"Size M"}, …]
CREATE OR REPLACE FUNCTION public.request_return(p_order_id uuid, p_kind text, p_reason text, p_details text, p_items jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_cust      uuid := private.require_customer();
  v_user      uuid := private.my_user_id();
  v_order     record;
  v_delivered timestamptz;
  v_item      jsonb;
  v_oi        record;
  v_qty       int;
  v_already   int;
  v_return    uuid;
  v_number    text;
  v_case      uuid;
  v_case_no   text;
  v_conv      uuid;
  v_refund    int := 0;
  v_summary   text := '';
BEGIN
  SELECT order_id, order_number, status INTO v_order FROM public.orders WHERE order_id = p_order_id AND customer_id = v_cust;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found' USING ERRCODE = '22023'; END IF;
  IF v_order.status <> 'delivered' THEN RAISE EXCEPTION 'You can return or exchange items once the order is delivered' USING ERRCODE = '22023'; END IF;
  SELECT max(created_at) INTO v_delivered FROM public.order_events WHERE order_id = p_order_id AND status = 'delivered';
  IF v_delivered IS NOT NULL AND v_delivered < now() - interval '30 days' THEN
    RAISE EXCEPTION 'Returns are accepted within 30 days of delivery' USING ERRCODE = '22023';
  END IF;
  IF p_kind NOT IN ('return','exchange') THEN RAISE EXCEPTION 'Please choose return or exchange' USING ERRCODE = '22023'; END IF;
  IF p_reason NOT IN ('damaged','wrong_item','wrong_size','not_as_described','changed_mind','faulty') THEN
    RAISE EXCEPTION 'Please choose a reason' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Please choose at least one item' USING ERRCODE = '22023';
  END IF;
  IF char_length(COALESCE(p_details,'')) > 500 THEN RAISE EXCEPTION 'Details can be up to 500 characters' USING ERRCODE = '22023'; END IF;

  INSERT INTO public.return_requests (order_id, customer_id, kind, reason, details)
  VALUES (p_order_id, v_cust, p_kind, p_reason, NULLIF(trim(COALESCE(p_details,'')),''))
  RETURNING return_id, return_number INTO v_return, v_number;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := (v_item ->> 'quantity')::int;
    SELECT * INTO v_oi FROM public.order_items WHERE order_item_id = (v_item ->> 'order_item_id')::uuid AND order_id = p_order_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'An item is not part of this order' USING ERRCODE = '22023'; END IF;
    -- Already in another open or finished return?
    SELECT COALESCE(sum(ri.quantity), 0) INTO v_already FROM public.return_items ri
      JOIN public.return_requests rr ON rr.return_id = ri.return_id
      WHERE ri.order_item_id = v_oi.order_item_id AND rr.status <> 'rejected' AND rr.return_id <> v_return;
    IF v_qty IS NULL OR v_qty < 1 OR v_qty > v_oi.quantity - v_already THEN
      RAISE EXCEPTION 'You can return up to % of %', GREATEST(v_oi.quantity - v_already, 0), v_oi.product_name USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.return_items (return_id, order_item_id, product_name, quantity, exchange_for)
    VALUES (v_return, v_oi.order_item_id, v_oi.product_name, v_qty,
            CASE WHEN p_kind = 'exchange' THEN NULLIF(left(trim(COALESCE(v_item ->> 'exchange_for','')),100),'') END);
    v_refund := v_refund + v_oi.unit_price_cents * v_qty;
    v_summary := v_summary || CASE WHEN v_summary = '' THEN '' ELSE ', ' END || v_qty || ' x ' || v_oi.product_name
                 || COALESCE(' (for ' || NULLIF(trim(COALESCE(v_item ->> 'exchange_for','')),'') || ')', '');
  END LOOP;
  IF p_kind = 'return' THEN UPDATE public.return_requests SET refund_cents = v_refund WHERE return_id = v_return; END IF;

  -- Open a case so the request appears in the staff queue with the full chat
  INSERT INTO public.cases (customer_id, status, priority, intent, sentiment, urgency, risk, confidence, subject, order_id, sla_due_at)
  VALUES (v_cust, 'escalated', 'normal', 'return_request', 'neutral', 'medium', 'medium', 1.000,
          left(initcap(p_kind) || ' ' || v_number || ' for order ' || v_order.order_number, 200), p_order_id, now() + interval '24 hours')
  RETURNING case_id, case_number INTO v_case, v_case_no;
  UPDATE public.return_requests SET case_id = v_case WHERE return_id = v_return;
  INSERT INTO public.conversations (case_id, channel) VALUES (v_case, 'web_form') RETURNING conversation_id INTO v_conv;
  INSERT INTO public.messages (conversation_id, sender_type, sender_id, content)
  VALUES (v_conv, 'customer', v_user, left('I would like to ' || p_kind || ': ' || v_summary || '. Reason: ' || replace(p_reason, '_', ' ')
          || COALESCE('. ' || NULLIF(trim(COALESCE(p_details,'')),''), ''), 2000));
  INSERT INTO public.messages (conversation_id, sender_type, sender_id, content, message_type)
  VALUES (v_conv, 'system', NULL, 'Thanks! Your ' || p_kind || ' request ' || v_number || ' has been sent to our team. We usually reply within 1 business day.', 'system_notice');
  INSERT INTO public.escalations (case_id, reason, escalated_from, escalated_to)
  VALUES (v_case, 'Return or exchange request', 'Customer portal', 'human_support_queue');
  INSERT INTO public.notifications (user_id, type, title, case_id, link)
  SELECT u.user_id, 'return_request', left(v_case_no || ': ' || p_kind || ' request ' || v_number, 120), v_case, '/cases/' || v_case
  FROM public.users u WHERE u.role IN ('support_agent','team_leader') AND u.status = 'active';
  INSERT INTO public.audit_logs (user_id, actor, actor_type, action, entity_type, entity_id, case_id, result, risk_level, details)
  VALUES (v_user, 'Customer', 'human', 'return_requested', 'return_requests', v_return, v_case, 'success', 'low',
          jsonb_build_object('return_number', v_number, 'kind', p_kind, 'order_number', v_order.order_number));

  RETURN jsonb_build_object('return_id', v_return, 'return_number', v_number, 'case_id', v_case);
END $$;

-- ---------- staff: move a return along ----------
CREATE OR REPLACE FUNCTION public.staff_update_return(p_return_id uuid, p_status text, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_me uuid := private.require_agent(); v_r record; v_msg text; v_conv uuid;
BEGIN
  SELECT * INTO v_r FROM public.return_requests WHERE return_id = p_return_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Return not found' USING ERRCODE = '22023'; END IF;
  IF (v_r.status, p_status) NOT IN (('requested','approved'), ('requested','rejected'), ('approved','received'), ('received','completed')) THEN
    RAISE EXCEPTION 'A return that is % can''t be changed to %', v_r.status, p_status USING ERRCODE = '22023';
  END IF;
  IF p_status = 'rejected' AND char_length(trim(COALESCE(p_note,''))) < 5 THEN
    RAISE EXCEPTION 'Please give the customer a reason' USING ERRCODE = '22023';
  END IF;
  UPDATE public.return_requests SET status = p_status, updated_at = now(),
         staff_note = COALESCE(NULLIF(left(trim(COALESCE(p_note,'')),300),''), staff_note)
  WHERE return_id = p_return_id;

  -- Put returned stock back once the parcel arrives
  IF p_status = 'received' THEN
    UPDATE public.products p SET stock = p.stock + ri.quantity
    FROM public.return_items ri JOIN public.order_items oi ON oi.order_item_id = ri.order_item_id
    WHERE ri.return_id = p_return_id AND oi.product_id = p.product_id;
  END IF;

  v_msg := CASE p_status
    WHEN 'approved' THEN 'Good news: your ' || v_r.kind || ' ' || v_r.return_number || ' is approved. Please post the items back within 14 days using the free return label we have emailed you.'
    WHEN 'rejected' THEN 'Sorry, we can''t accept ' || v_r.return_number || '.'
    WHEN 'received' THEN 'We have received the items for ' || v_r.return_number || ' and are checking them now.'
    ELSE CASE v_r.kind WHEN 'return' THEN v_r.return_number || ' is complete. Your refund of $' || to_char(v_r.refund_cents / 100.0, 'FM999990.00') || ' is on its way (3 to 5 business days).'
                       ELSE v_r.return_number || ' is complete. Your replacement is on its way.' END END
    || COALESCE(' ' || NULLIF(trim(COALESCE(p_note,'')),''), '');
  v_conv := private.case_conversation(v_r.case_id);
  IF v_conv IS NOT NULL THEN
    INSERT INTO public.messages (conversation_id, sender_type, sender_id, content) VALUES (v_conv, 'human_agent', v_me, left(v_msg, 2000));
    UPDATE public.cases SET status = CASE WHEN p_status IN ('completed','rejected') THEN 'resolved' ELSE 'human_handling' END,
           first_response_at = COALESCE(first_response_at, now()), updated_at = now()
    WHERE case_id = v_r.case_id;
    IF NOT EXISTS (SELECT 1 FROM public.case_assignments WHERE case_id = v_r.case_id AND status = 'active') THEN
      INSERT INTO public.case_assignments (case_id, user_id) VALUES (v_r.case_id, v_me);
    END IF;
  END IF;
  INSERT INTO public.notifications (user_id, type, title, case_id, link)
  SELECT cu.user_id, 'return_update', left(v_r.return_number || ': ' || p_status, 120), v_r.case_id, '/account/returns'
  FROM public.customers cu WHERE cu.customer_id = v_r.customer_id;
  INSERT INTO public.audit_logs (user_id, actor, actor_type, action, entity_type, entity_id, case_id, result, risk_level, details)
  SELECT v_me, u.name, 'human', 'return_' || p_status, 'return_requests', p_return_id, v_r.case_id, 'success', 'low',
         jsonb_build_object('return_number', v_r.return_number) FROM public.users u WHERE u.user_id = v_me;
END $$;

-- ---------- staff order updates now tell the customer ----------
CREATE OR REPLACE FUNCTION private.notify_order_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('processing','shipped','delivered','cancelled') THEN
    INSERT INTO public.notifications (user_id, type, title, link)
    SELECT cu.user_id, 'order_update',
           left(NEW.order_number || CASE NEW.status WHEN 'processing' THEN ' is being packed' WHEN 'shipped' THEN ' is on the way'
                                                    WHEN 'delivered' THEN ' was delivered' ELSE ' was cancelled' END, 120),
           '/account/orders/' || NEW.order_id
    FROM public.customers cu WHERE cu.customer_id = NEW.customer_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_orders_notify AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION private.notify_order_update();

-- ---------- customer: rate a resolved chat ----------
CREATE OR REPLACE FUNCTION public.rate_case(p_case_id uuid, p_rating int, p_comment text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_cust uuid := private.require_customer();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.cases WHERE case_id = p_case_id AND customer_id = v_cust AND status IN ('resolved','closed')) THEN
    RAISE EXCEPTION 'You can rate a chat once it is resolved' USING ERRCODE = '22023';
  END IF;
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN RAISE EXCEPTION 'Please choose 1 to 5 stars' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM public.feedback WHERE case_id = p_case_id) THEN RAISE EXCEPTION 'You have already rated this chat. Thank you!' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.feedback (case_id, rating, comment) VALUES (p_case_id, p_rating, NULLIF(left(trim(COALESCE(p_comment,'')),500),''));
END $$;

-- ---------- everyone: mark own notifications read ----------
CREATE OR REPLACE FUNCTION public.mark_notifications_read()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  UPDATE public.notifications SET read_at = now() WHERE user_id = private.my_user_id() AND read_at IS NULL
$$;

REVOKE EXECUTE ON FUNCTION private.require_agent(), private.case_customer_user(uuid), private.case_conversation(uuid),
  private.notify_order_update() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION
  public.staff_take_case(uuid), public.staff_reply(uuid,text), public.staff_set_status(uuid,text,text),
  public.staff_add_note(uuid,text), public.customer_reply(uuid,text), public.request_return(uuid,text,text,text,jsonb),
  public.staff_update_return(uuid,text,text), public.rate_case(uuid,int,text), public.mark_notifications_read()
  FROM public, anon;
GRANT EXECUTE ON FUNCTION
  public.staff_take_case(uuid), public.staff_reply(uuid,text), public.staff_set_status(uuid,text,text),
  public.staff_add_note(uuid,text), public.customer_reply(uuid,text), public.request_return(uuid,text,text,text,jsonb),
  public.staff_update_return(uuid,text,text), public.rate_case(uuid,int,text), public.mark_notifications_read()
  TO authenticated;

COMMIT;

-- Check: the new tables are locked down (RLS on)
SELECT tablename, rowsecurity AS rls_enabled FROM pg_tables
WHERE schemaname = 'public' AND tablename IN ('case_notes','return_requests','return_items') ORDER BY tablename;
