-- =====================================================================
-- 013  Customers page shows customers only   (Week 7 fix)
-- Run after 012.
--
-- Why: staff accounts that were first made through the public sign-up page
-- got a row in "customers". When an admin later changed their role to staff,
-- that row stayed (it keeps any old orders and chats). The Customers page
-- listed every row in "customers", so staff appeared there too.
-- Fix: the view now only lists people whose role is "customer".
-- =====================================================================

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
JOIN public.users u ON u.user_id = c.user_id
WHERE u.role = 'customer';   -- staff who once signed up as customers keep a customer row; hide them
GRANT SELECT ON public.v_customer_overview TO authenticated;
