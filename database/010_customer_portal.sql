-- =====================================================================
-- NexusCX AI - Migration 010: customer portal (shop, orders, addresses)
-- Run AFTER 009_smarter_answers.sql, once, in the Supabase SQL Editor.
--
-- 1. products            - the demo store's catalogue (12 sample products)
-- 2. customer_addresses  - saved delivery addresses, one default per customer
-- 3. orders, order_items, order_events - orders and their status history
-- 4. cases.order_id      - a support request can be about one order
-- 5. Functions (every write goes through one of these, never straight to a table):
--      save_address / delete_address / set_default_address   (customer)
--      place_order / cancel_order                            (customer)
--      ask_about_order                                       (customer, starts a chat)
--      customer_reply                                        (customer, follow-up in a chat)
--      staff_update_order                                    (staff with resolve_cases)
-- 6. v_order_queue view for the staff Orders page
-- Customers only ever see their own rows (Row Level Security).
-- =====================================================================
BEGIN;

-- ---------- 1. products ----------
CREATE TABLE public.products (
    product_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku          VARCHAR(20)  NOT NULL UNIQUE,
    name         VARCHAR(100) NOT NULL,
    category     VARCHAR(20)  NOT NULL CHECK (category IN ('audio','wearables','computing','home','accessories')),
    description  VARCHAR(300) NOT NULL,
    price_cents  INTEGER NOT NULL CHECK (price_cents > 0),
    stock        INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    active       BOOLEAN NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.products (sku, name, category, description, price_cents, stock) VALUES
 ('AUD-100', 'Aurora Wireless Headphones', 'audio',       'Over-ear, noise cancelling, 30-hour battery.',              24900, 25),
 ('AUD-110', 'Pulse Earbuds',              'audio',       'True wireless earbuds with charging case.',                 12900, 40),
 ('AUD-120', 'Boom Mini Speaker',          'audio',       'Water-resistant Bluetooth speaker, 12-hour battery.',        7900, 30),
 ('WRB-200', 'Stride Fitness Watch',       'wearables',   'Heart rate, GPS and sleep tracking.',                       19900, 18),
 ('WRB-210', 'Loop Smart Band',            'wearables',   'Slim activity band with 10-day battery.',                    6900, 35),
 ('CMP-300', 'Nimbus 14 Laptop Sleeve',    'computing',   'Padded sleeve for 13 to 14 inch laptops.',                   3900, 50),
 ('CMP-310', 'Swift Wireless Mouse',       'computing',   'Quiet clicks, USB-C charging.',                              4900, 60),
 ('CMP-320', 'Keyline Mechanical Keyboard','computing',   'Compact 75% layout with hot-swap switches.',                15900, 12),
 ('HOM-400', 'Glow Desk Lamp',             'home',        'Dimmable LED lamp with USB charging port.',                  5900, 22),
 ('HOM-410', 'Brew Insulated Bottle',      'home',        'Keeps drinks cold for 24 hours, 750 ml.',                    3400, 80),
 ('ACC-500', 'Charge Duo Power Bank',      'accessories', '10,000 mAh, charges two devices at once.',                   5400, 45),
 ('ACC-510', 'Weave USB-C Cable (2 m)',    'accessories', 'Braided cable, fast charging and data.',                     1900, 100);

-- ---------- 2. customer addresses ----------
CREATE TABLE public.customer_addresses (
    address_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id  UUID NOT NULL REFERENCES public.customers(customer_id) ON DELETE CASCADE,
    label        VARCHAR(30)  NOT NULL DEFAULT 'Home',
    recipient    VARCHAR(100) NOT NULL,
    line1        VARCHAR(120) NOT NULL,
    line2        VARCHAR(120),
    suburb       VARCHAR(60)  NOT NULL,
    state        VARCHAR(3)   NOT NULL CHECK (state IN ('NSW','VIC','QLD','WA','SA','TAS','ACT','NT')),
    postcode     CHAR(4)      NOT NULL CHECK (postcode ~ '^[0-9]{4}$'),
    phone        VARCHAR(20),
    is_default   BOOLEAN NOT NULL DEFAULT false,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_addresses_customer ON public.customer_addresses (customer_id);
CREATE UNIQUE INDEX one_default_address ON public.customer_addresses (customer_id) WHERE is_default;

-- ---------- 3. orders ----------
CREATE SEQUENCE public.order_number_seq START 1001;
CREATE TABLE public.orders (
    order_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number    VARCHAR(12) NOT NULL UNIQUE DEFAULT ('NX-' || nextval('public.order_number_seq')),
    customer_id     UUID NOT NULL REFERENCES public.customers(customer_id) ON DELETE RESTRICT,
    status          VARCHAR(12) NOT NULL DEFAULT 'placed'
                    CHECK (status IN ('placed','processing','shipped','delivered','cancelled')),
    -- delivery address copied at order time, so editing an address later never changes a past order
    ship_recipient  VARCHAR(100) NOT NULL,
    ship_address    VARCHAR(400) NOT NULL,
    subtotal_cents  INTEGER NOT NULL CHECK (subtotal_cents >= 0),
    shipping_cents  INTEGER NOT NULL CHECK (shipping_cents >= 0),
    total_cents     INTEGER NOT NULL CHECK (total_cents = subtotal_cents + shipping_cents),
    notes           VARCHAR(300),
    tracking_number VARCHAR(40),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_orders_customer ON public.orders (customer_id, created_at DESC);
CREATE INDEX idx_orders_status ON public.orders (status);

CREATE TABLE public.order_items (
    order_item_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id         UUID NOT NULL REFERENCES public.orders(order_id) ON DELETE CASCADE,
    product_id       UUID REFERENCES public.products(product_id) ON DELETE SET NULL,
    product_name     VARCHAR(100) NOT NULL,
    category         VARCHAR(20)  NOT NULL,
    unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents > 0),
    quantity         INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 10),
    line_total_cents INTEGER NOT NULL CHECK (line_total_cents = unit_price_cents * quantity)
);
CREATE INDEX idx_order_items_order ON public.order_items (order_id);

CREATE TABLE public.order_events (
    event_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id   UUID NOT NULL REFERENCES public.orders(order_id) ON DELETE CASCADE,
    status     VARCHAR(12) NOT NULL CHECK (status IN ('placed','processing','shipped','delivered','cancelled')),
    note       VARCHAR(200),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_order_events_order ON public.order_events (order_id, created_at);

-- ---------- 4. a support case can be about an order ----------
ALTER TABLE public.cases ADD COLUMN order_id UUID REFERENCES public.orders(order_id) ON DELETE SET NULL;
CREATE INDEX idx_cases_order ON public.cases (order_id);

-- ---------- Row Level Security ----------
ALTER TABLE public.products           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_events       ENABLE ROW LEVEL SECURITY;

-- Reads only; every change goes through the functions below
GRANT SELECT ON public.products, public.customer_addresses, public.orders,
                public.order_items, public.order_events TO authenticated;

CREATE POLICY "Everyone signed in sees active products; staff see all" ON public.products FOR SELECT TO authenticated
  USING (active OR (SELECT private.has_permission('view_cases')));
CREATE POLICY "Customers see own addresses; staff see all" ON public.customer_addresses FOR SELECT TO authenticated
  USING (customer_id = (SELECT private.my_customer_id()) OR (SELECT private.has_permission('view_cases')));
CREATE POLICY "Customers see own orders; staff see all" ON public.orders FOR SELECT TO authenticated
  USING (customer_id = (SELECT private.my_customer_id()) OR (SELECT private.has_permission('view_cases')));
CREATE POLICY "Items of visible orders" ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.order_id = order_items.order_id));
CREATE POLICY "Events of visible orders" ON public.order_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.order_id = order_events.order_id));

-- ---------- helper: the signed-in customer, or a clear error ----------
CREATE OR REPLACE FUNCTION private.require_customer() RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v uuid := private.my_customer_id();
BEGIN
  IF v IS NULL THEN RAISE EXCEPTION 'Only signed-in customers can do this' USING ERRCODE = '42501'; END IF;
  RETURN v;
END $$;

-- ---------- 5a. addresses ----------
CREATE OR REPLACE FUNCTION public.save_address(
  p_address_id uuid, p_label text, p_recipient text, p_line1 text, p_line2 text,
  p_suburb text, p_state text, p_postcode text, p_phone text, p_default boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_cust uuid := private.require_customer();
  v_id   uuid := p_address_id;
  v_count int;
BEGIN
  IF char_length(trim(COALESCE(p_recipient,''))) < 2 THEN RAISE EXCEPTION 'Please enter the name of the person receiving the delivery' USING ERRCODE = '22023'; END IF;
  IF char_length(trim(COALESCE(p_line1,''))) < 3 THEN RAISE EXCEPTION 'Please enter the street address' USING ERRCODE = '22023'; END IF;
  IF char_length(trim(COALESCE(p_suburb,''))) < 2 THEN RAISE EXCEPTION 'Please enter the suburb' USING ERRCODE = '22023'; END IF;
  IF upper(COALESCE(p_state,'')) NOT IN ('NSW','VIC','QLD','WA','SA','TAS','ACT','NT') THEN RAISE EXCEPTION 'Please choose a state' USING ERRCODE = '22023'; END IF;
  IF COALESCE(p_postcode,'') !~ '^[0-9]{4}$' THEN RAISE EXCEPTION 'Postcode must be 4 digits' USING ERRCODE = '22023'; END IF;

  SELECT count(*) INTO v_count FROM public.customer_addresses WHERE customer_id = v_cust;

  IF v_id IS NULL THEN
    IF v_count >= 10 THEN RAISE EXCEPTION 'You can save up to 10 addresses' USING ERRCODE = '22023'; END IF;
    INSERT INTO public.customer_addresses (customer_id, label, recipient, line1, line2, suburb, state, postcode, phone)
    VALUES (v_cust, left(COALESCE(NULLIF(trim(p_label),''),'Home'),30), left(trim(p_recipient),100), left(trim(p_line1),120),
            NULLIF(left(trim(COALESCE(p_line2,'')),120),''), left(trim(p_suburb),60), upper(p_state), p_postcode,
            NULLIF(left(trim(COALESCE(p_phone,'')),20),''))
    RETURNING address_id INTO v_id;
  ELSE
    UPDATE public.customer_addresses SET
      label = left(COALESCE(NULLIF(trim(p_label),''),'Home'),30), recipient = left(trim(p_recipient),100),
      line1 = left(trim(p_line1),120), line2 = NULLIF(left(trim(COALESCE(p_line2,'')),120),''),
      suburb = left(trim(p_suburb),60), state = upper(p_state), postcode = p_postcode,
      phone = NULLIF(left(trim(COALESCE(p_phone,'')),20),'')
    WHERE address_id = v_id AND customer_id = v_cust;
    IF NOT FOUND THEN RAISE EXCEPTION 'Address not found' USING ERRCODE = '22023'; END IF;
  END IF;

  -- First address is the default automatically
  IF p_default OR v_count = 0 THEN
    UPDATE public.customer_addresses SET is_default = false WHERE customer_id = v_cust AND is_default AND address_id <> v_id;
    UPDATE public.customer_addresses SET is_default = true WHERE address_id = v_id;
  END IF;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.set_default_address(p_address_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_cust uuid := private.require_customer();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.customer_addresses WHERE address_id = p_address_id AND customer_id = v_cust) THEN
    RAISE EXCEPTION 'Address not found' USING ERRCODE = '22023';
  END IF;
  UPDATE public.customer_addresses SET is_default = false WHERE customer_id = v_cust AND is_default;
  UPDATE public.customer_addresses SET is_default = true WHERE address_id = p_address_id;
END $$;

CREATE OR REPLACE FUNCTION public.delete_address(p_address_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_cust uuid := private.require_customer(); v_was_default boolean;
BEGIN
  DELETE FROM public.customer_addresses WHERE address_id = p_address_id AND customer_id = v_cust
  RETURNING is_default INTO v_was_default;
  IF NOT FOUND THEN RAISE EXCEPTION 'Address not found' USING ERRCODE = '22023'; END IF;
  -- Keep one default if any addresses are left
  IF v_was_default THEN
    UPDATE public.customer_addresses SET is_default = true
    WHERE address_id = (SELECT address_id FROM public.customer_addresses WHERE customer_id = v_cust ORDER BY created_at LIMIT 1);
  END IF;
END $$;

-- ---------- 5b. place an order ----------
-- p_items = [{"product_id":"…","quantity":2}, …]
-- Prices and stock are read from the database, never trusted from the browser.
CREATE OR REPLACE FUNCTION public.place_order(p_address_id uuid, p_items jsonb, p_notes text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_cust      uuid := private.require_customer();
  v_user      uuid := private.my_user_id();
  v_addr      record;
  v_item      jsonb;
  v_prod      record;
  v_qty       int;
  v_subtotal  int := 0;
  v_shipping  int;
  v_order_id  uuid;
  v_number    text;
  v_lines     int;
BEGIN
  SELECT * INTO v_addr FROM public.customer_addresses WHERE address_id = p_address_id AND customer_id = v_cust;
  IF NOT FOUND THEN RAISE EXCEPTION 'Please choose a delivery address' USING ERRCODE = '22023'; END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Your cart is empty' USING ERRCODE = '22023';
  END IF;
  v_lines := jsonb_array_length(p_items);
  IF v_lines > 20 THEN RAISE EXCEPTION 'Please order at most 20 different products at once' USING ERRCODE = '22023'; END IF;
  IF (SELECT count(DISTINCT x ->> 'product_id') FROM jsonb_array_elements(p_items) x) <> v_lines THEN
    RAISE EXCEPTION 'Each product can appear only once in the cart' USING ERRCODE = '22023';
  END IF;
  IF char_length(COALESCE(p_notes,'')) > 300 THEN RAISE EXCEPTION 'Delivery notes can be up to 300 characters' USING ERRCODE = '22023'; END IF;

  INSERT INTO public.orders (customer_id, ship_recipient, ship_address, subtotal_cents, shipping_cents, total_cents, notes)
  VALUES (v_cust, v_addr.recipient,
          concat_ws(', ', v_addr.line1, v_addr.line2, v_addr.suburb || ' ' || v_addr.state || ' ' || v_addr.postcode),
          0, 0, 0, NULLIF(trim(COALESCE(p_notes,'')),''))
  RETURNING order_id, order_number INTO v_order_id, v_number;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := (v_item ->> 'quantity')::int;
    IF v_qty IS NULL OR v_qty < 1 OR v_qty > 10 THEN
      RAISE EXCEPTION 'Quantity must be between 1 and 10' USING ERRCODE = '22023';
    END IF;
    -- Lock the product row so two orders cannot sell the same last item
    SELECT * INTO v_prod FROM public.products
    WHERE product_id = (v_item ->> 'product_id')::uuid AND active FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'A product in your cart is no longer available' USING ERRCODE = '22023'; END IF;
    IF v_prod.stock < v_qty THEN
      RAISE EXCEPTION 'Only % left of %', v_prod.stock, v_prod.name USING ERRCODE = '22023';
    END IF;
    UPDATE public.products SET stock = stock - v_qty WHERE product_id = v_prod.product_id;
    INSERT INTO public.order_items (order_id, product_id, product_name, category, unit_price_cents, quantity, line_total_cents)
    VALUES (v_order_id, v_prod.product_id, v_prod.name, v_prod.category, v_prod.price_cents, v_qty, v_prod.price_cents * v_qty);
    v_subtotal := v_subtotal + v_prod.price_cents * v_qty;
  END LOOP;

  v_shipping := CASE WHEN v_subtotal >= 10000 THEN 0 ELSE 995 END;   -- free delivery from $100
  UPDATE public.orders SET subtotal_cents = v_subtotal, shipping_cents = v_shipping, total_cents = v_subtotal + v_shipping
  WHERE order_id = v_order_id;
  INSERT INTO public.order_events (order_id, status, note) VALUES (v_order_id, 'placed', 'Order received');
  INSERT INTO public.audit_logs (user_id, actor, actor_type, action, entity_type, entity_id, result, risk_level, details)
  VALUES (v_user, 'Customer', 'human', 'order_placed', 'orders', v_order_id, 'success', 'low',
          jsonb_build_object('order_number', v_number, 'total_cents', v_subtotal + v_shipping));

  RETURN jsonb_build_object('order_id', v_order_id, 'order_number', v_number, 'total_cents', v_subtotal + v_shipping);
END $$;

-- ---------- 5c. cancel (only before it ships) ----------
CREATE OR REPLACE FUNCTION public.cancel_order(p_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_cust uuid := private.require_customer(); v_status text; v_number text;
BEGIN
  SELECT status, order_number INTO v_status, v_number FROM public.orders
  WHERE order_id = p_order_id AND customer_id = v_cust FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found' USING ERRCODE = '22023'; END IF;
  IF v_status NOT IN ('placed','processing') THEN
    RAISE EXCEPTION 'This order has already shipped, so it can''t be cancelled. You can return it after delivery.' USING ERRCODE = '22023';
  END IF;
  -- Put the stock back
  UPDATE public.products p SET stock = p.stock + i.quantity
  FROM public.order_items i WHERE i.order_id = p_order_id AND i.product_id = p.product_id;
  UPDATE public.orders SET status = 'cancelled', updated_at = now() WHERE order_id = p_order_id;
  INSERT INTO public.order_events (order_id, status, note) VALUES (p_order_id, 'cancelled', 'Cancelled by customer');
  INSERT INTO public.audit_logs (user_id, actor, actor_type, action, entity_type, entity_id, result, risk_level, details)
  VALUES (private.my_user_id(), 'Customer', 'human', 'order_cancelled', 'orders', p_order_id, 'success', 'low',
          jsonb_build_object('order_number', v_number));
END $$;

-- ---------- 5d. ask about an order: a normal enquiry, linked to the order ----------
CREATE OR REPLACE FUNCTION public.ask_about_order(p_order_id uuid, p_message text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_cust uuid := private.require_customer(); v_number text; v_result jsonb;
BEGIN
  SELECT order_number INTO v_number FROM public.orders WHERE order_id = p_order_id AND customer_id = v_cust;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found' USING ERRCODE = '22023'; END IF;
  v_result := public.submit_enquiry('About my order ' || v_number || ': ' || trim(COALESCE(p_message,'')));
  UPDATE public.cases SET order_id = p_order_id WHERE case_id = (v_result ->> 'case_id')::uuid;
  RETURN v_result || jsonb_build_object('order_number', v_number);
END $$;

-- ---------- 5e. customer follow-up message in an existing chat ----------
CREATE OR REPLACE FUNCTION public.customer_reply(p_case_id uuid, p_message text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_cust uuid := private.require_customer();
  v_text text := trim(COALESCE(p_message,''));
  v_case record;
  v_conv uuid;
BEGIN
  SELECT case_id, case_number, status INTO v_case FROM public.cases WHERE case_id = p_case_id AND customer_id = v_cust FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conversation not found' USING ERRCODE = '22023'; END IF;
  IF v_case.status = 'closed' THEN RAISE EXCEPTION 'This conversation is closed. Please start a new one.' USING ERRCODE = '22023'; END IF;
  IF char_length(v_text) < 2 OR char_length(v_text) > 2000 THEN
    RAISE EXCEPTION 'Please write between 2 and 2000 characters' USING ERRCODE = '22023';
  END IF;
  SELECT conversation_id INTO v_conv FROM public.conversations WHERE case_id = p_case_id ORDER BY started_at LIMIT 1;
  INSERT INTO public.messages (conversation_id, sender_type, sender_id, content)
  VALUES (v_conv, 'customer', private.my_user_id(), v_text);
  -- A reply puts the case back in front of a person
  IF v_case.status IN ('ai_handling','waiting','resolved') THEN
    UPDATE public.cases SET status = 'escalated', updated_at = now() WHERE case_id = p_case_id;
    INSERT INTO public.notifications (user_id, type, title, case_id)
    SELECT u.user_id, 'new_escalation', left(v_case.case_number || ': customer replied', 120), p_case_id
    FROM public.users u WHERE u.role IN ('support_agent','team_leader') AND u.status = 'active';
  END IF;
  INSERT INTO public.audit_logs (user_id, actor, actor_type, action, entity_type, entity_id, case_id, result, risk_level)
  VALUES (private.my_user_id(), 'Customer', 'human', 'customer_replied', 'cases', p_case_id, p_case_id, 'success', 'low');
END $$;

-- ---------- 5f. staff move an order along ----------
CREATE OR REPLACE FUNCTION public.staff_update_order(p_order_id uuid, p_status text, p_tracking text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_old text; v_number text; v_ok boolean;
BEGIN
  IF NOT private.has_permission('resolve_cases') THEN
    RAISE EXCEPTION 'Only staff who can resolve cases can update orders' USING ERRCODE = '42501';
  END IF;
  SELECT status, order_number INTO v_old, v_number FROM public.orders WHERE order_id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found' USING ERRCODE = '22023'; END IF;
  v_ok := (v_old, p_status) IN (('placed','processing'), ('processing','shipped'), ('shipped','delivered'),
                                ('placed','cancelled'), ('processing','cancelled'));
  IF NOT v_ok THEN
    RAISE EXCEPTION 'An order that is % can''t be changed to %', v_old, p_status USING ERRCODE = '22023';
  END IF;
  IF p_status = 'shipped' AND char_length(trim(COALESCE(p_tracking,''))) < 4 THEN
    RAISE EXCEPTION 'Please add a tracking number when shipping' USING ERRCODE = '22023';
  END IF;
  IF p_status = 'cancelled' THEN
    UPDATE public.products p SET stock = p.stock + i.quantity
    FROM public.order_items i WHERE i.order_id = p_order_id AND i.product_id = p.product_id;
  END IF;
  UPDATE public.orders SET status = p_status, updated_at = now(),
         tracking_number = COALESCE(NULLIF(trim(COALESCE(p_tracking,'')),''), tracking_number)
  WHERE order_id = p_order_id;
  INSERT INTO public.order_events (order_id, status, note)
  VALUES (p_order_id, p_status, CASE p_status WHEN 'processing' THEN 'Being packed at our warehouse'
                                              WHEN 'shipped' THEN 'Handed to the courier'
                                              WHEN 'delivered' THEN 'Delivered'
                                              ELSE 'Cancelled by our team' END);
  INSERT INTO public.audit_logs (user_id, actor, actor_type, action, entity_type, entity_id, result, risk_level, details)
  SELECT u.user_id, u.name, 'human', 'order_status_changed', 'orders', p_order_id, 'success', 'low',
         jsonb_build_object('order_number', v_number, 'from', v_old, 'to', p_status)
  FROM public.users u WHERE u.user_id = private.my_user_id();
END $$;

REVOKE EXECUTE ON FUNCTION private.require_customer() FROM public, anon;
GRANT EXECUTE ON FUNCTION private.require_customer() TO authenticated;
REVOKE EXECUTE ON FUNCTION
  public.save_address(uuid,text,text,text,text,text,text,text,text,boolean), public.set_default_address(uuid),
  public.delete_address(uuid), public.place_order(uuid,jsonb,text), public.cancel_order(uuid),
  public.ask_about_order(uuid,text), public.customer_reply(uuid,text), public.staff_update_order(uuid,text,text)
  FROM public, anon;
GRANT EXECUTE ON FUNCTION
  public.save_address(uuid,text,text,text,text,text,text,text,text,boolean), public.set_default_address(uuid),
  public.delete_address(uuid), public.place_order(uuid,jsonb,text), public.cancel_order(uuid),
  public.ask_about_order(uuid,text), public.customer_reply(uuid,text), public.staff_update_order(uuid,text,text)
  TO authenticated;

-- ---------- 6. staff order queue ----------
CREATE VIEW public.v_order_queue WITH (security_invoker = true) AS
SELECT o.order_id, o.order_number, o.status, o.total_cents, o.tracking_number, o.created_at, o.updated_at,
       o.ship_recipient, o.ship_address, u.name AS customer_name, u.email AS customer_email,
       (SELECT COALESCE(sum(i.quantity), 0) FROM public.order_items i WHERE i.order_id = o.order_id)::int AS item_count,
       (SELECT count(*) FROM public.cases c WHERE c.order_id = o.order_id
          AND c.status NOT IN ('resolved','closed'))::int AS open_cases
FROM public.orders o
JOIN public.customers cu ON cu.customer_id = o.customer_id
JOIN public.users u ON u.user_id = cu.user_id;
GRANT SELECT ON public.v_order_queue TO authenticated;

-- ---------- sample data for the seeded customer Alex Nguyen ----------
INSERT INTO public.customer_addresses (customer_id, label, recipient, line1, suburb, state, postcode, phone, is_default)
SELECT '00000000-0000-0000-0000-000000000101', 'Home', 'Alex Nguyen', '12 Harbour St', 'Sydney', 'NSW', '2000', '+61412345678', true
WHERE EXISTS (SELECT 1 FROM public.customers WHERE customer_id = '00000000-0000-0000-0000-000000000101');

DO $$
DECLARE v_cust uuid := '00000000-0000-0000-0000-000000000101'; v_o uuid; r record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE customer_id = v_cust) THEN RETURN; END IF;
  FOR r IN SELECT * FROM (VALUES
      ('AUD-100', 1, 'delivered', 21), ('CMP-310', 2, 'shipped', 3), ('HOM-410', 1, 'processing', 1)) AS t(sku, qty, st, days)
  LOOP
    INSERT INTO public.orders (customer_id, status, ship_recipient, ship_address, subtotal_cents, shipping_cents, total_cents,
                               tracking_number, created_at, updated_at)
    SELECT v_cust, r.st, 'Alex Nguyen', '12 Harbour St, Sydney NSW 2000', p.price_cents * r.qty,
           CASE WHEN p.price_cents * r.qty >= 10000 THEN 0 ELSE 995 END,
           p.price_cents * r.qty + CASE WHEN p.price_cents * r.qty >= 10000 THEN 0 ELSE 995 END,
           CASE WHEN r.st IN ('shipped','delivered') THEN 'AP' || (7000000 + r.days * 13)::text END,
           now() - make_interval(days => r.days), now() - make_interval(days => r.days)
    FROM public.products p WHERE p.sku = r.sku
    RETURNING order_id INTO v_o;
    INSERT INTO public.order_items (order_id, product_id, product_name, category, unit_price_cents, quantity, line_total_cents)
    SELECT v_o, p.product_id, p.name, p.category, p.price_cents, r.qty, p.price_cents * r.qty FROM public.products p WHERE p.sku = r.sku;
    INSERT INTO public.order_events (order_id, status, note, created_at)
    SELECT v_o, s.st, s.note, now() - make_interval(days => r.days) + make_interval(hours => s.h)
    FROM (VALUES ('placed','Order received',0,1), ('processing','Being packed at our warehouse',4,2),
                 ('shipped','Handed to the courier',20,3), ('delivered','Delivered',72,4)) AS s(st, note, h, n)
    WHERE s.n <= CASE r.st WHEN 'placed' THEN 1 WHEN 'processing' THEN 2 WHEN 'shipped' THEN 3 ELSE 4 END;
  END LOOP;
END $$;

COMMIT;

-- Check: the new tables are locked down (RLS on) and the catalogue is loaded
SELECT tablename, rowsecurity AS rls_enabled FROM pg_tables
WHERE schemaname = 'public' AND tablename IN ('products','customer_addresses','orders','order_items','order_events')
ORDER BY tablename;
