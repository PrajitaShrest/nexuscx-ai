-- =====================================================================
-- NexusCX AI - Migration 025: the AI changes a size or colour on an order
-- Run AFTER 024_student_wording.sql, in the Supabase SQL Editor.
-- Safe to run more than once. Running it again also refreshes the demo
-- order (so it is "placed 3 hours ago" again on presentation day).
--
-- What it adds:
--   * Products can have options: band size (S, M, L), sleeve size, colour.
--   * Each order line remembers the option chosen (order_items.variant).
--   * public.ai_change_order_option(): the Orders Agent checks who the
--     customer is (order number + delivery postcode), checks the rules
--     (ordered in the last 2 days, not shipped yet), then changes the
--     size or colour. No staff member is needed.
--     Every check and change is written to the audit log, the order
--     history, and a case that is closed as "resolved by AI".
--   * A demo order for every store customer: Stride Fitness Watch,
--     band size M, placed 3 hours ago, being packed.
-- =====================================================================
BEGIN;

-- ---------- options on products and order lines ----------
ALTER TABLE public.products    ADD COLUMN IF NOT EXISTS option_label varchar(20);
ALTER TABLE public.products    ADD COLUMN IF NOT EXISTS options text[];
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS variant varchar(30);

UPDATE public.products p SET option_label = v.label, options = v.opts
FROM (VALUES
  ('WRB-200', 'Band size', ARRAY['S','M','L']),
  ('WRB-210', 'Band size', ARRAY['S','M','L']),
  ('CMP-300', 'Size',      ARRAY['13 inch','14 inch']),
  ('AUD-100', 'Colour',    ARRAY['Black','Silver']),
  ('AUD-110', 'Colour',    ARRAY['Black','White'])
) AS v(sku, label, opts)
WHERE p.sku = v.sku;

-- Existing order lines get a sensible option (M for 3 sizes, otherwise the first)
UPDATE public.order_items i
SET variant = CASE WHEN array_length(p.options, 1) = 3 THEN p.options[2] ELSE p.options[1] END
FROM public.products p
WHERE p.product_id = i.product_id AND p.options IS NOT NULL AND i.variant IS NULL;

-- ---------- the AI action ----------
-- Step 1 (p_item NULL): check the order and who is asking; return what can be changed.
-- Step 2 (p_item set):  check again, then make the change.
CREATE OR REPLACE FUNCTION public.ai_change_order_option(
  p_order_number text, p_postcode text, p_item uuid DEFAULT NULL, p_new text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_cust     uuid := private.my_customer_id();
  v_user     uuid := private.my_user_id();
  v_agent    uuid := '00000000-0000-0000-0000-000000000203';   -- Orders Agent
  v_o        record;
  v_i        record;
  v_post     text;
  v_items    jsonb;
  v_case     uuid;
  v_case_no  text;
  v_conv     uuid;
  v_ask      text;
  v_reply    text;
BEGIN
  IF v_cust IS NULL THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Please sign in to your customer account first.');
  END IF;

  SELECT o.* INTO v_o FROM public.orders o
  WHERE upper(o.order_number) = upper(trim(COALESCE(p_order_number, ''))) AND o.customer_id = v_cust;

  -- the postcode is the last 4-digit number in the delivery address
  IF FOUND THEN
    v_post := (SELECT (regexp_match(v_o.ship_address, '.*(\d{4})'))[1]);
  END IF;

  IF NOT FOUND OR v_post IS NULL OR v_post <> trim(COALESCE(p_postcode, '')) THEN
    INSERT INTO public.audit_logs (user_id, actor, actor_type, action, entity_type, result, risk_level, details)
    VALUES (v_user, 'Orders Agent', 'ai_agent', 'identity_check_failed', 'orders', 'blocked', 'medium',
            jsonb_build_object('order_number', left(COALESCE(p_order_number, ''), 20)));
    RETURN jsonb_build_object('status', 'error', 'message',
      'I could not match that order number and postcode on your account. Please check them and try again. You can find the order number in My orders.');
  END IF;

  IF v_o.status IN ('shipped', 'delivered') THEN
    RETURN jsonb_build_object('status', 'error', 'message',
      'Order ' || v_o.order_number || ' has already ' || CASE v_o.status WHEN 'shipped' THEN 'left our warehouse' ELSE 'been delivered' END
      || ', so I can''t change it now. Once it arrives, you can exchange it for free within 30 days from My orders → Return or exchange.');
  ELSIF v_o.status = 'cancelled' THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Order ' || v_o.order_number || ' was cancelled, so there is nothing to change.');
  ELSIF v_o.created_at < now() - interval '2 days' THEN
    RETURN jsonb_build_object('status', 'error', 'message',
      'Order ' || v_o.order_number || ' was placed more than 2 days ago, so I can''t change it myself. Choose "Talk to a person" and our team will check if it can still be changed.');
  END IF;

  -- ---------- step 1: what can be changed ----------
  IF p_item IS NULL THEN
    SELECT jsonb_agg(jsonb_build_object('order_item_id', i.order_item_id, 'product_name', i.product_name,
                     'label', p.option_label, 'current', i.variant, 'options', to_jsonb(p.options)) ORDER BY i.product_name)
    INTO v_items
    FROM public.order_items i JOIN public.products p ON p.product_id = i.product_id
    WHERE i.order_id = v_o.order_id AND p.options IS NOT NULL;

    INSERT INTO public.audit_logs (user_id, actor, actor_type, action, entity_type, entity_id, result, risk_level, details)
    VALUES (v_user, 'Orders Agent', 'ai_agent', 'identity_verified', 'orders', v_o.order_id, 'success', 'low',
            jsonb_build_object('order_number', v_o.order_number, 'checked', 'order number + delivery postcode'));

    IF v_items IS NULL THEN
      RETURN jsonb_build_object('status', 'error', 'message',
        'Thanks, that''s confirmed. Nothing on order ' || v_o.order_number || ' has a size or colour to choose, so there is nothing to change.');
    END IF;
    RETURN jsonb_build_object('status', 'verified', 'order_number', v_o.order_number, 'items', v_items);
  END IF;

  -- ---------- step 2: make the change ----------
  SELECT i.order_item_id, i.product_name, i.variant, p.option_label, p.options INTO v_i
  FROM public.order_items i JOIN public.products p ON p.product_id = i.product_id
  WHERE i.order_item_id = p_item AND i.order_id = v_o.order_id AND p.options IS NOT NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'That item is not on this order.');
  END IF;
  IF p_new IS NULL OR NOT (p_new = ANY (v_i.options)) THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Please choose one of the ' || lower(v_i.option_label) || ' options shown.');
  END IF;
  IF p_new = v_i.variant THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Your ' || v_i.product_name || ' is already ' || p_new || '.');
  END IF;

  UPDATE public.order_items SET variant = p_new WHERE order_item_id = v_i.order_item_id;
  UPDATE public.orders SET updated_at = now() WHERE order_id = v_o.order_id;
  INSERT INTO public.order_events (order_id, status, note)
  VALUES (v_o.order_id, v_o.status, left(v_i.option_label || ' changed from ' || COALESCE(v_i.variant, 'none') || ' to ' || p_new || ' by the AI assistant', 200));

  -- a case, closed as resolved by the AI, so it shows in chat history and analytics
  v_ask   := 'Please change the ' || lower(v_i.option_label) || ' of my ' || v_i.product_name || ' on order ' || v_o.order_number
          || ' from ' || COALESCE(v_i.variant, 'none') || ' to ' || p_new || '.';
  v_reply := 'Done! I''ve changed the ' || lower(v_i.option_label) || ' of your ' || v_i.product_name || ' on order ' || v_o.order_number
          || ' from ' || COALESCE(v_i.variant, 'none') || ' to ' || p_new || '. There is no extra charge, and your delivery date stays the same.';
  INSERT INTO public.cases (customer_id, status, priority, intent, sentiment, urgency, risk, confidence, subject,
                            assigned_agent_id, order_id, industry, first_response_at, resolved_at)
  VALUES (v_cust, 'resolved', 'low', 'order_change', 'neutral', 'low', 'low', 0.97, left(v_ask, 200),
          v_agent, v_o.order_id, 'ecommerce', now(), now())
  RETURNING case_id, case_number INTO v_case, v_case_no;
  INSERT INTO public.conversations (case_id, channel) VALUES (v_case, 'web_chat') RETURNING conversation_id INTO v_conv;
  INSERT INTO public.messages (conversation_id, sender_type, sender_id, content) VALUES (v_conv, 'customer', v_user, v_ask);
  INSERT INTO public.messages (conversation_id, sender_type, sender_id, content) VALUES (v_conv, 'ai_agent', v_agent, v_reply);

  INSERT INTO public.audit_logs (user_id, actor, actor_type, action, entity_type, entity_id, case_id, result, risk_level, details)
  VALUES (v_user, 'Orders Agent', 'ai_agent', 'order_item_changed', 'orders', v_o.order_id, v_case, 'success', 'low',
          jsonb_build_object('order_number', v_o.order_number, 'item', v_i.product_name,
                             'from', v_i.variant, 'to', p_new, 'rule', 'within 2 days and not shipped'));
  INSERT INTO public.notifications (user_id, type, title, case_id, link)
  VALUES (v_user, 'order_update', left(v_o.order_number || ': ' || lower(v_i.option_label) || ' changed to ' || p_new, 120),
          v_case, '/account/orders/' || v_o.order_id);

  RETURN jsonb_build_object('status', 'changed', 'message', v_reply, 'case_number', v_case_no, 'order_id', v_o.order_id);
END $$;
REVOKE EXECUTE ON FUNCTION public.ai_change_order_option(text, text, uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.ai_change_order_option(text, text, uuid, text) TO authenticated;

-- ---------- help article (so the AI can explain the rule in any wording) ----------
INSERT INTO public.knowledge_documents (title, category, keywords, content, status, version, owner, approved_by, approved_at, source, industry)
SELECT 'Changing the size or colour of an order', 'orders',
       'change size colour color swap band wrong size bigger smaller exchange order variant',
       'I can change the size or colour of an item myself if you ordered it in the last 2 days and it hasn''t shipped yet. '
       || 'Just type "change the size" here, then give me your order number and the delivery postcode so I can check it''s you. '
       || 'There is no extra charge and your delivery date stays the same. If the order has already shipped, you can exchange it for free within 30 days of delivery from My orders.',
       'approved', 'v1.0', 'Orders Team',
       (SELECT user_id FROM public.users WHERE role = 'knowledge_manager' ORDER BY name LIMIT 1), now(), 'NexusCX Store Help Centre', 'ecommerce'
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_documents WHERE title = 'Changing the size or colour of an order');

-- ---------- demo order for every store customer (refreshed on every run) ----------
DO $$
DECLARE
  r      record;
  v_o    uuid;
  v_p    record;
  v_addr text;
BEGIN
  SELECT * INTO v_p FROM public.products WHERE sku = 'WRB-200';
  IF NOT FOUND THEN RETURN; END IF;
  FOR r IN SELECT c.customer_id, u.name FROM public.customers c JOIN public.users u ON u.user_id = c.user_id
           WHERE u.role = 'customer' AND u.industry = 'ecommerce' AND u.status = 'active' LOOP
    SELECT o.order_id INTO v_o FROM public.orders o WHERE o.customer_id = r.customer_id AND o.notes = 'Demo order' LIMIT 1;
    IF v_o IS NULL THEN
      SELECT a.line1 || ', ' || a.suburb || ' ' || a.state || ' ' || a.postcode INTO v_addr
      FROM public.customer_addresses a WHERE a.customer_id = r.customer_id ORDER BY a.is_default DESC LIMIT 1;
      INSERT INTO public.orders (customer_id, status, ship_recipient, ship_address, subtotal_cents, shipping_cents, total_cents, notes)
      VALUES (r.customer_id, 'processing', left(r.name, 100), COALESCE(v_addr, '1 George St, Sydney NSW 2000'),
              v_p.price_cents, 0, v_p.price_cents, 'Demo order')
      RETURNING order_id INTO v_o;
      INSERT INTO public.order_items (order_id, product_id, product_name, category, unit_price_cents, quantity, line_total_cents, variant)
      VALUES (v_o, v_p.product_id, v_p.name, v_p.category, v_p.price_cents, 1, v_p.price_cents, 'M');
    END IF;
    -- fresh again: placed 3 hours ago, being packed, band size M
    UPDATE public.orders SET status = 'processing', tracking_number = NULL,
           created_at = now() - interval '3 hours', updated_at = now() - interval '2 hours'
    WHERE order_id = v_o;
    UPDATE public.order_items SET variant = 'M' WHERE order_id = v_o;
    DELETE FROM public.order_events WHERE order_id = v_o;
    INSERT INTO public.order_events (order_id, status, note, created_at) VALUES
      (v_o, 'placed', 'Order received', now() - interval '3 hours'),
      (v_o, 'processing', 'Being packed at our warehouse', now() - interval '2 hours');
    v_o := NULL;
  END LOOP;
END $$;

COMMIT;
