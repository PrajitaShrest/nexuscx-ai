-- 031_batch2.sql  (run after 030)
-- 1. Talk to a person: a call-back or a booked appointment when the AI could not help.
--    Rule: wellbeing and product-safety cases never have to book a time. They get an
--    URGENT call-back (target 15 minutes) and the crisis numbers. Other cases can ask for a
--    call back today, or book a time with the right team (phone, video or in person).
-- 2. Special consideration: the AI fills the form, but a person in Academic Services always decides.
-- Safe to run more than once.

-- ---------- appointments ----------
CREATE TABLE IF NOT EXISTS public.appointments (
  appointment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id    uuid NOT NULL REFERENCES public.customers(customer_id) ON DELETE CASCADE,
  case_id        uuid REFERENCES public.cases(case_id) ON DELETE SET NULL,
  industry       varchar(20) NOT NULL,
  kind           varchar(10) NOT NULL CHECK (kind IN ('callback', 'booking')),
  urgency        varchar(10) NOT NULL DEFAULT 'normal' CHECK (urgency IN ('urgent', 'today', 'normal')),
  team           varchar(80) NOT NULL,
  mode           varchar(20) NOT NULL CHECK (mode IN ('Phone call', 'Video call', 'In person')),
  slot_at        timestamptz,
  phone          varchar(20),
  note           varchar(500),
  status         varchar(12) NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'booked', 'done', 'missed', 'cancelled')),
  handled_by     uuid REFERENCES public.users(user_id),
  handled_note   varchar(300),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  done_at        timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS appointments_slot_taken ON public.appointments (team, slot_at) WHERE status = 'booked';
CREATE INDEX IF NOT EXISTS appointments_customer ON public.appointments (customer_id, created_at DESC);
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "My appointments" ON public.appointments;
CREATE POLICY "My appointments" ON public.appointments FOR SELECT TO authenticated
  USING (customer_id = (SELECT private.my_customer_id()));
DROP POLICY IF EXISTS "Staff see appointments of their organisation" ON public.appointments;
CREATE POLICY "Staff see appointments of their organisation" ON public.appointments FOR SELECT TO authenticated
  USING ((SELECT private.has_permission('view_cases')) AND industry = (SELECT public.current_industry()));
GRANT SELECT ON public.appointments TO authenticated;
-- No INSERT/UPDATE grants: every change goes through the functions below.

-- Who can be booked, per organisation
CREATE OR REPLACE FUNCTION private.booking_teams(p_industry text) RETURNS text[]
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN p_industry = 'university'
    THEN ARRAY['Student Centre', 'Academic Services', 'Student Services', 'Student Wellbeing', 'IT Service Desk', 'Admissions & Finance']
    ELSE ARRAY['Customer Support'] END
$$;

-- Open times: the next 10 working days, 9:00 to 16:30 Sydney time, every 30 minutes, at least 2 hours ahead
CREATE OR REPLACE FUNCTION private.slot_times() RETURNS SETOF timestamptz
LANGUAGE sql STABLE SET search_path = '' AS $$
  WITH days AS (
    SELECT d::date AS d FROM generate_series((now() AT TIME ZONE 'Australia/Sydney')::date,
                                            (now() AT TIME ZONE 'Australia/Sydney')::date + 16, interval '1 day') d
    WHERE extract(isodow FROM d) < 6
    ORDER BY d LIMIT 11
  )
  SELECT ((d + time '09:00' + n * interval '30 minutes') AT TIME ZONE 'Australia/Sydney')
  FROM days, generate_series(0, 15) n
  WHERE ((d + time '09:00' + n * interval '30 minutes') AT TIME ZONE 'Australia/Sydney') > now() + interval '2 hours'
  ORDER BY 1
$$;

-- Staff of the right team (or any team leader) hear about it
CREATE OR REPLACE FUNCTION private.notify_booking_team(p_industry text, p_team text, p_title text, p_case uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO public.notifications (user_id, type, title, case_id, link)
  SELECT u.user_id, 'new_request', left(p_title, 120), p_case, '/bookings'
  FROM public.users u LEFT JOIN public.teams tm ON tm.team_id = u.team_id
  WHERE u.status = 'active' AND u.role IN ('support_agent', 'team_leader') AND u.industry = p_industry
    AND (u.role = 'team_leader' OR p_industry <> 'university' OR tm.name = p_team
         OR (p_team = 'Student Wellbeing' AND tm.name = 'Student Services'))
$$;
REVOKE ALL ON FUNCTION private.booking_teams(text), private.slot_times(), private.notify_booking_team(text, text, text, uuid) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION private.clean_phone(p text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$ SELECT NULLIF(regexp_replace(COALESCE(p, ''), '[^0-9+]', '', 'g'), '') $$;

-- What the "Talk to a person" panel needs: teams, open times, my phone number
CREATE OR REPLACE FUNCTION public.booking_options() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_cust uuid := private.require_customer();
  v_ind  text := public.current_industry();
BEGIN
  RETURN jsonb_build_object(
    'teams', to_jsonb(private.booking_teams(v_ind)),
    'slots', COALESCE((SELECT jsonb_agg(s ORDER BY s) FROM private.slot_times() s), '[]'),
    'taken', COALESCE((SELECT jsonb_object_agg(team, at) FROM (
               SELECT team, jsonb_agg(slot_at ORDER BY slot_at) AS at FROM public.appointments
               WHERE status = 'booked' AND industry = v_ind AND slot_at > now() GROUP BY team) x), '{}'),
    'phone', (SELECT phone FROM public.customers WHERE customer_id = v_cust));
END $$;
REVOKE ALL ON FUNCTION public.booking_options() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.booking_options() TO authenticated;

-- ---------- "Call me back" ----------
CREATE OR REPLACE FUNCTION public.request_callback(p_case uuid, p_phone text, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_cust   uuid := private.require_customer();
  v_user   uuid := private.my_user_id();
  v_ind    text := public.current_industry();
  v_phone  text := private.clean_phone(p_phone);
  v_flag   text;
  v_urg    text;
  v_team   text;
  v_open   uuid;
  v_id     uuid;
  v_conv   uuid;
  v_name   text := (SELECT name FROM public.users WHERE user_id = private.my_user_id());
BEGIN
  IF v_phone IS NULL OR v_phone !~ '^\+?[0-9]{8,15}$' THEN
    RAISE EXCEPTION 'Please enter a phone number we can call, for example 0412 345 678.' USING ERRCODE = '22023';
  END IF;
  IF p_case IS NOT NULL THEN
    SELECT safety_flag INTO v_flag FROM public.cases WHERE case_id = p_case AND customer_id = v_cust;
    IF NOT FOUND THEN RAISE EXCEPTION 'Conversation not found.' USING ERRCODE = '22023'; END IF;
  END IF;
  v_urg  := CASE WHEN v_flag IN ('wellbeing', 'product_safety') THEN 'urgent' ELSE 'today' END;
  v_team := CASE WHEN v_ind <> 'university' THEN CASE WHEN v_flag = 'product_safety' THEN 'Product Safety' ELSE 'Customer Support' END
                 WHEN v_flag = 'wellbeing' THEN 'Student Wellbeing' ELSE 'Student Services' END;

  -- one open call-back at a time
  SELECT appointment_id INTO v_open FROM public.appointments
  WHERE customer_id = v_cust AND kind = 'callback' AND status = 'requested' LIMIT 1;
  IF v_open IS NOT NULL THEN
    UPDATE public.appointments SET phone = v_phone, updated_at = now(),
           urgency = CASE WHEN v_urg = 'urgent' THEN 'urgent' ELSE urgency END
    WHERE appointment_id = v_open;
    RETURN jsonb_build_object('appointment_id', v_open, 'urgency', v_urg, 'already', true);
  END IF;

  INSERT INTO public.appointments (customer_id, case_id, industry, kind, urgency, team, mode, phone, note)
  VALUES (v_cust, p_case, v_ind, 'callback', v_urg, v_team, 'Phone call', v_phone, left(NULLIF(trim(p_note), ''), 500))
  RETURNING appointment_id INTO v_id;
  UPDATE public.customers SET phone = COALESCE(phone, left(v_phone, 20)) WHERE customer_id = v_cust;

  IF p_case IS NOT NULL THEN
    v_conv := private.case_conversation(p_case);
    INSERT INTO public.messages (conversation_id, sender_type, sender_id, content, message_type)
    VALUES (v_conv, 'system', NULL,
            CASE WHEN v_urg = 'urgent' THEN 'You asked for a call back. This is urgent, so a person will call you on ' || v_phone || ' as soon as possible, usually within 15 minutes.'
                      || CASE WHEN v_flag = 'wellbeing' THEN ' If you are in danger right now, call 000. Lifeline is there any time on 13 11 14.' ELSE ' If anyone is hurt, call 000.' END
                 ELSE 'You asked for a call back. A person from ' || v_team || ' will call you on ' || v_phone || ' today (Monday to Friday, 9am to 5pm).' END,
            'escalation_notice');
    UPDATE public.cases SET status = CASE WHEN status IN ('resolved', 'closed') THEN status ELSE 'escalated' END,
           priority = CASE WHEN v_urg = 'urgent' THEN 'urgent' ELSE priority END, updated_at = now()
    WHERE case_id = p_case;
    IF NOT EXISTS (SELECT 1 FROM public.escalations WHERE case_id = p_case) THEN
      INSERT INTO public.escalations (case_id, reason, escalated_from, escalated_to)
      VALUES (p_case, 'Asked to talk to a person', 'Orchestrator', 'human_support_queue');
    END IF;
  END IF;
  PERFORM private.notify_booking_team(v_ind, v_team,
    CASE WHEN v_urg = 'urgent' THEN 'URGENT call-back: ' ELSE 'Call back today: ' END || COALESCE(v_name, 'someone'), p_case);
  INSERT INTO public.audit_logs (user_id, actor, actor_type, action, entity_type, entity_id, case_id, result, risk_level, details)
  VALUES (v_user, CASE WHEN v_ind = 'university' THEN 'Student' ELSE 'Customer' END, 'human', 'callback_requested', 'appointments', v_id, p_case,
          'success', CASE WHEN v_urg = 'urgent' THEN 'high' ELSE 'low' END, jsonb_build_object('team', v_team, 'urgency', v_urg));
  RETURN jsonb_build_object('appointment_id', v_id, 'urgency', v_urg, 'team', v_team);
END $$;
REVOKE ALL ON FUNCTION public.request_callback(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.request_callback(uuid, text, text) TO authenticated;

-- ---------- "Book a time" ----------
CREATE OR REPLACE FUNCTION public.book_appointment(p_team text, p_slot timestamptz, p_mode text, p_phone text,
  p_note text DEFAULT NULL, p_case uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_cust  uuid := private.require_customer();
  v_user  uuid := private.my_user_id();
  v_ind   text := public.current_industry();
  v_phone text := private.clean_phone(p_phone);
  v_flag  text;
  v_id    uuid;
  v_name  text := (SELECT name FROM public.users WHERE user_id = private.my_user_id());
BEGIN
  IF NOT (p_team = ANY (private.booking_teams(v_ind))) THEN RAISE EXCEPTION 'Please choose a team.' USING ERRCODE = '22023'; END IF;
  IF p_mode NOT IN ('Phone call', 'Video call', 'In person') THEN RAISE EXCEPTION 'Please choose how you want to meet.' USING ERRCODE = '22023'; END IF;
  IF p_mode = 'In person' AND v_ind <> 'university' THEN RAISE EXCEPTION 'Please choose a phone or video call.' USING ERRCODE = '22023'; END IF;
  IF p_mode = 'Phone call' AND (v_phone IS NULL OR v_phone !~ '^\+?[0-9]{8,15}$') THEN
    RAISE EXCEPTION 'Please enter a phone number we can call, for example 0412 345 678.' USING ERRCODE = '22023';
  END IF;
  IF p_case IS NOT NULL THEN
    SELECT safety_flag INTO v_flag FROM public.cases WHERE case_id = p_case AND customer_id = v_cust;
    IF NOT FOUND THEN RAISE EXCEPTION 'Conversation not found.' USING ERRCODE = '22023'; END IF;
    -- the duty-of-care rule: urgent things never wait for a booking
    IF v_flag IN ('wellbeing', 'product_safety') THEN
      RAISE EXCEPTION 'This is urgent, so you don''t need to book. Choose "Call me now" and a person will call you as soon as possible.' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM private.slot_times() s WHERE s = p_slot) THEN
    RAISE EXCEPTION 'That time is not available. Please pick another time.' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(*) FROM public.appointments WHERE customer_id = v_cust AND status = 'booked' AND slot_at > now()) >= 3 THEN
    RAISE EXCEPTION 'You already have 3 bookings coming up. Please cancel one before booking another.' USING ERRCODE = '22023';
  END IF;

  BEGIN
    INSERT INTO public.appointments (customer_id, case_id, industry, kind, urgency, team, mode, slot_at, phone, note, status)
    VALUES (v_cust, p_case, v_ind, 'booking', 'normal', p_team, p_mode, p_slot, v_phone, left(NULLIF(trim(p_note), ''), 500), 'booked')
    RETURNING appointment_id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Someone just booked that time. Please pick another.' USING ERRCODE = '22023';
  END;
  IF v_phone IS NOT NULL THEN UPDATE public.customers SET phone = COALESCE(phone, left(v_phone, 20)) WHERE customer_id = v_cust; END IF;

  IF p_case IS NOT NULL THEN
    INSERT INTO public.messages (conversation_id, sender_type, sender_id, content, message_type)
    VALUES (private.case_conversation(p_case), 'system', NULL,
            'Booked: ' || lower(p_mode) || ' with ' || p_team || ' on '
            || to_char(p_slot AT TIME ZONE 'Australia/Sydney', 'FMDay FMDD FMMonth "at" FMHH12:MI am') || '. You can see or cancel it in My appointments.',
            'escalation_notice');
  END IF;
  PERFORM private.notify_booking_team(v_ind, p_team,
    'New booking: ' || COALESCE(v_name, 'someone') || ', ' || to_char(p_slot AT TIME ZONE 'Australia/Sydney', 'Dy DD Mon HH24:MI'), p_case);
  INSERT INTO public.audit_logs (user_id, actor, actor_type, action, entity_type, entity_id, case_id, result, risk_level, details)
  VALUES (v_user, CASE WHEN v_ind = 'university' THEN 'Student' ELSE 'Customer' END, 'human', 'appointment_booked', 'appointments', v_id, p_case,
          'success', 'low', jsonb_build_object('team', p_team, 'mode', p_mode, 'slot', p_slot));
  RETURN jsonb_build_object('appointment_id', v_id, 'slot_at', p_slot, 'team', p_team);
END $$;
REVOKE ALL ON FUNCTION public.book_appointment(text, timestamptz, text, text, text, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.book_appointment(text, timestamptz, text, text, text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_my_appointment(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_cust uuid := private.require_customer();
BEGIN
  UPDATE public.appointments SET status = 'cancelled', updated_at = now()
  WHERE appointment_id = p_id AND customer_id = v_cust AND status IN ('requested', 'booked');
  IF NOT FOUND THEN RAISE EXCEPTION 'This appointment can no longer be cancelled.' USING ERRCODE = '22023'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.cancel_my_appointment(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cancel_my_appointment(uuid) TO authenticated;

-- ---------- staff: take, done, missed, cancel ----------
CREATE OR REPLACE FUNCTION public.staff_update_appointment(p_id uuid, p_action text, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_me    uuid := private.my_user_id();
  v_ind   text := public.current_industry();
  v_a     public.appointments;
  v_owner uuid;
  v_msg   text;
BEGIN
  IF NOT private.has_permission('view_cases') THEN RAISE EXCEPTION 'You do not have permission to do this.' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_a FROM public.appointments WHERE appointment_id = p_id AND industry = v_ind FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Appointment not found.' USING ERRCODE = '22023'; END IF;
  IF v_a.status NOT IN ('requested', 'booked') THEN RAISE EXCEPTION 'This appointment is already finished.' USING ERRCODE = '22023'; END IF;
  IF p_action NOT IN ('take', 'done', 'missed', 'cancel') THEN RAISE EXCEPTION 'Unknown action.' USING ERRCODE = '22023'; END IF;
  SELECT c.user_id INTO v_owner FROM public.customers c WHERE c.customer_id = v_a.customer_id;

  UPDATE public.appointments SET
    handled_by = v_me, updated_at = now(),
    handled_note = COALESCE(left(NULLIF(trim(p_note), ''), 300), handled_note),
    status = CASE p_action WHEN 'done' THEN 'done' WHEN 'missed' THEN 'missed' WHEN 'cancel' THEN 'cancelled' ELSE status END,
    done_at = CASE WHEN p_action IN ('done', 'missed', 'cancel') THEN now() ELSE done_at END
  WHERE appointment_id = p_id;

  v_msg := CASE p_action
    WHEN 'take' THEN NULL
    WHEN 'done' THEN NULL
    WHEN 'missed' THEN 'We tried to call you but could not reach you. You can ask for another call or book a time.'
    WHEN 'cancel' THEN 'Your appointment with ' || v_a.team || ' was cancelled by our team' || COALESCE(': ' || NULLIF(trim(p_note), ''), '.') END;
  IF v_msg IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, link) VALUES (v_owner, 'request_update', left(v_msg, 120), '/account/appointments');
  END IF;
  -- the person who takes an urgent call-back also takes the chat
  IF p_action = 'take' AND v_a.case_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.case_assignments WHERE case_id = v_a.case_id AND status = 'active') THEN
    INSERT INTO public.case_assignments (case_id, user_id, status) VALUES (v_a.case_id, v_me, 'active');
    UPDATE public.cases SET status = 'human_handling', updated_at = now() WHERE case_id = v_a.case_id;
  END IF;
  INSERT INTO public.audit_logs (user_id, actor, actor_type, action, entity_type, entity_id, case_id, result, risk_level, details)
  VALUES (v_me, (SELECT name FROM public.users WHERE user_id = v_me), 'human', 'appointment_' || p_action, 'appointments', p_id, v_a.case_id,
          'success', 'low', jsonb_build_object('kind', v_a.kind, 'team', v_a.team));
  RETURN jsonb_build_object('status', p_action);
END $$;
REVOKE ALL ON FUNCTION public.staff_update_appointment(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.staff_update_appointment(uuid, text, text) TO authenticated;

-- ---------- special consideration: a person always decides ----------
INSERT INTO public.request_types (type_key, industry, title, summary, team_name, icon, keywords, fields, sla_hours, fee_note, sort) VALUES
('special_consideration', 'university', 'Special consideration',
 'Ask for an extension or a deferred exam when illness, a family emergency or another serious problem affected your study. A person in Academic Services always decides.',
 'Academic Services', 'document',
 'special consideration|(extension|extend)\b.*\b(assignment|essay|report|due date|deadline)|\b(assignment|essay|report)\b.*\bextension|defer(red)? (my |an |the )?exam|miss(ed)? (my |an |the )?(exam|test)|\b(sick|ill|hospital|funeral|passed away|bereavement|family emergency)\b.*\b(exam|assignment|test|due)\b|\b(exam|assignment|test)\b.*\b(sick|ill|hospital|funeral|passed away|family emergency)\b',
 '[
   {"name":"full_name","label":"Full name","type":"text","required":true,"prefill":"name","readonly":true},
   {"name":"student_number","label":"Student number","type":"text","required":true,"prefill":"student_number","readonly":true},
   {"name":"unit","label":"Unit","type":"text","required":true,"max":80,"help":"For example: ICT101 Introduction to Programming"},
   {"name":"assessment","label":"Which assessment?","type":"select","required":true,"options":["Exam","Assignment","Test or quiz","Presentation","Other"]},
   {"name":"due_date","label":"Due date or exam date","type":"date","required":true},
   {"name":"reason","label":"What happened?","type":"select","required":true,"options":["Illness or injury","Family emergency or bereavement","Mental health","Work or caring duties","Other serious problem"]},
   {"name":"asking","label":"What are you asking for?","type":"select","required":true,"options":["An extension (a new due date)","A deferred exam","Another assessment instead","Not sure, please advise"]},
   {"name":"details","label":"Tell us briefly how it affected your study","type":"textarea","required":true,"max":1000},
   {"name":"evidence","label":"Photo of your evidence (optional), for example a medical certificate","type":"photo","required":false},
   {"name":"confirm","label":"I confirm this is true. I understand that a false claim is academic misconduct.","type":"checkbox","required":true}
 ]', 72, 'Free. A person in Academic Services decides, usually within 3 working days. If you are struggling right now, you can talk to a person from any chat.', 5)
ON CONFLICT (type_key) DO UPDATE SET industry = EXCLUDED.industry, title = EXCLUDED.title, summary = EXCLUDED.summary,
  team_name = EXCLUDED.team_name, icon = EXCLUDED.icon, keywords = EXCLUDED.keywords, fields = EXCLUDED.fields,
  sla_hours = EXCLUDED.sla_hours, fee_note = EXCLUDED.fee_note, sort = EXCLUDED.sort, active = true;

-- Live updates for the Bookings page and My appointments
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'appointments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
  END IF;
END $$;

-- ---------- staff decide special consideration (from 026) ----------
CREATE OR REPLACE FUNCTION public.staff_update_service_request(p_id uuid, p_action text, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_me      uuid := private.my_user_id();
  v_me_name text;
  v_r       public.service_requests;
  v_t       public.request_types;
  v_owner   uuid;
  v_note    text := NULLIF(btrim(COALESCE(p_note, '')), '');
  v_status  text;
  v_outcome jsonb := '{}'::jsonb;
  v_pickup  boolean := false;
  v_msg     text;
  v_place   text;
  v_addr    text;
  v_old     text;
  v_no      int;
BEGIN
  IF NOT private.has_permission('view_cases') THEN RAISE EXCEPTION 'Only staff can do this.' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_r FROM public.service_requests WHERE request_id = p_id FOR UPDATE;
  IF NOT FOUND OR v_r.industry <> public.current_industry() THEN RAISE EXCEPTION 'That request could not be found.' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_t FROM public.request_types WHERE type_key = v_r.type_key;
  SELECT name INTO v_me_name FROM public.users WHERE user_id = v_me;
  SELECT user_id INTO v_owner FROM public.customers WHERE customer_id = v_r.customer_id;
  v_place := CASE WHEN v_r.industry = 'university' THEN 'the Student Centre, Building A, ground floor (Mon–Fri, 9am–5pm). Bring photo ID'
                  ELSE 'our warehouse' END;
  IF v_note IS NOT NULL AND length(v_note) > 500 THEN RAISE EXCEPTION 'Please keep the note under 500 characters.' USING ERRCODE = '22023'; END IF;

  IF p_action = 'start' THEN
    IF v_r.status NOT IN ('submitted') THEN RAISE EXCEPTION 'This request is not waiting to be started.' USING ERRCODE = '22023'; END IF;
    v_status := 'in_review';
    v_msg := v_r.request_number || ': ' || v_me_name || ' is working on your ' || v_t.title;

  ELSIF p_action = 'need_info' THEN
    IF v_r.status NOT IN ('submitted', 'in_review') THEN RAISE EXCEPTION 'Changes can only be asked for before the request is finished.' USING ERRCODE = '22023'; END IF;
    IF v_note IS NULL OR length(v_note) < 10 THEN RAISE EXCEPTION 'Please say what needs changing (at least 10 characters).' USING ERRCODE = '22023'; END IF;
    v_status := 'needs_info';
    v_msg := v_r.request_number || ': please check your ' || v_t.title || ' request';

  ELSIF p_action = 'reject' THEN
    IF v_r.status NOT IN ('submitted', 'in_review', 'needs_info') THEN RAISE EXCEPTION 'This request is already finished.' USING ERRCODE = '22023'; END IF;
    IF v_note IS NULL OR length(v_note) < 10 THEN RAISE EXCEPTION 'Please give the reason (at least 10 characters).' USING ERRCODE = '22023'; END IF;
    v_status := 'rejected';
    v_msg := v_r.request_number || ': your ' || v_t.title || ' request could not be completed';

  ELSIF p_action = 'collected' THEN
    IF v_r.status <> 'ready' THEN RAISE EXCEPTION 'Only a request that is ready to collect can be marked as collected.' USING ERRCODE = '22023'; END IF;
    v_status := 'completed';
    v_outcome := jsonb_build_object('collected_at', now(), 'collected_by_staff', v_me_name);
    v_msg := v_r.request_number || ': collected. Thank you!';

  ELSIF p_action = 'ready' THEN
    IF v_r.status NOT IN ('submitted', 'in_review') THEN RAISE EXCEPTION 'This request is not ready to be finished.' USING ERRCODE = '22023'; END IF;
    v_pickup := COALESCE(v_r.details->>'delivery', '') IN ('Digital card + collect a physical card', 'Digital letter + printed copy to collect', 'Collect from the Student Centre');

    IF v_r.type_key = 'id_card' THEN
      SELECT count(*) + 1 INTO v_no FROM public.service_requests
      WHERE customer_id = v_r.customer_id AND type_key = 'id_card' AND outcome ? 'card_number';
      v_outcome := jsonb_build_object('card_number', (v_r.details->>'student_number') || '-' || v_no,
                     'issued', current_date, 'expires', (date_trunc('year', current_date) + interval '4 years - 1 day')::date,
                     'digital', true);
      v_msg := v_r.request_number || ': your student ID card is ready' || CASE WHEN v_pickup THEN ' to collect' ELSE '' END;

    ELSIF v_r.type_key = 'enrolment_letter' THEN
      v_outcome := jsonb_build_object('reference', 'EL-' || substr(v_r.request_number, 4), 'issued', current_date, 'issued_by', v_me_name);
      v_msg := v_r.request_number || ': your enrolment letter is ready';

    ELSIF v_r.type_key = 'transcript' THEN
      v_outcome := jsonb_build_object('reference', 'TR-' || substr(v_r.request_number, 4), 'issued', current_date, 'issued_by', v_me_name,
                     'sent', CASE v_r.details->>'delivery' WHEN 'Email me a PDF' THEN 'Emailed as a PDF'
                                                          WHEN 'Post to me' THEN 'Posted to ' || (v_r.details->>'postal_address') ELSE NULL END);
      v_msg := v_r.request_number || ': your transcript is ' || CASE WHEN v_pickup THEN 'ready to collect' ELSE 'on its way' END;

    ELSIF v_r.type_key = 'parking_permit' THEN
      v_outcome := jsonb_build_object('permit_number', 'P' || substr(v_r.request_number, 4) || '-' || (v_r.details->>'rego'),
                     'valid_from', (v_r.details->>'start_date')::date,
                     'valid_to', CASE WHEN v_r.details->>'permit' LIKE 'Semester%' THEN ((v_r.details->>'start_date')::date + interval '5 months')::date
                                      WHEN v_r.details->>'permit' LIKE 'Full year%' THEN ((v_r.details->>'start_date')::date + interval '1 year - 1 day')::date
                                      ELSE (v_r.details->>'start_date')::date END);
      v_msg := v_r.request_number || ': your parking permit is active';

    ELSIF v_r.type_key = 'special_consideration' THEN
      -- 031: a person decided; their note (if any) is shown to the student
      v_outcome := jsonb_build_object('decision', 'Approved', 'decided_by', v_me_name, 'decided_on', current_date);
      v_msg := v_r.request_number || ': your special consideration was approved';

    ELSIF v_r.type_key = 'credit_transfer' THEN
      -- the assessor confirms the units the AI could not decide alone
      v_outcome := jsonb_build_object('assessor', v_me_name, 'assessor_date', current_date);
      v_msg := v_r.request_number || ': your credit decision is complete';

    ELSIF v_r.type_key = 'delivery_address' THEN
      -- make the change on the order itself, if it still hasn't shipped
      v_addr := concat_ws(', ', v_r.details->>'line1', NULLIF(v_r.details->>'line2', ''),
                          (v_r.details->>'suburb') || ' ' || (v_r.details->>'state') || ' ' || (v_r.details->>'postcode'));
      SELECT ship_address INTO v_old FROM public.orders WHERE order_id = v_r.order_id AND status IN ('placed', 'processing') FOR UPDATE;
      IF v_old IS NULL THEN RAISE EXCEPTION 'The order has already shipped, so the address can no longer be changed. Please reject the request with a note.' USING ERRCODE = '22023'; END IF;
      UPDATE public.orders SET ship_address = left(v_addr, 400), ship_recipient = left(v_r.details->>'recipient', 100),
             updated_at = now()
      WHERE order_id = v_r.order_id;
      INSERT INTO public.order_events (order_id, status, note)
      SELECT v_r.order_id, o.status, left('Delivery address changed to ' || v_addr
                    || COALESCE('. Instructions: ' || NULLIF(v_r.details->>'instructions', ''), ''), 200)
      FROM public.orders o WHERE o.order_id = v_r.order_id;
      v_outcome := jsonb_build_object('old_address', v_old, 'new_address', v_addr);
      v_msg := v_r.request_number || ': delivery address changed for ' || (v_r.details->>'order');
    END IF;

    IF v_pickup THEN v_outcome := v_outcome || jsonb_build_object('pickup', 'Collect from ' || v_place || '.'); END IF;
    v_status := CASE WHEN v_pickup THEN 'ready' ELSE 'completed' END;
  ELSE
    RAISE EXCEPTION 'Unknown action.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.service_requests SET
    status = v_status, updated_at = now(),
    assigned_to = COALESCE(assigned_to, v_me),
    staff_note = CASE WHEN p_action IN ('need_info', 'reject') THEN v_note ELSE COALESCE(v_note, staff_note) END,
    outcome = outcome || v_outcome,
    ready_at = CASE WHEN p_action = 'ready' THEN now() ELSE ready_at END,
    completed_at = CASE WHEN v_status IN ('completed', 'rejected') THEN now() ELSE completed_at END
  WHERE request_id = p_id;

  INSERT INTO public.service_request_events (request_id, status, note, actor_name, actor_type)
  VALUES (p_id, v_status, COALESCE(v_note, CASE p_action WHEN 'start' THEN 'Started checking the details.'
                                                    WHEN 'ready' THEN CASE WHEN v_pickup THEN 'Ready to collect.' ELSE 'Done.' END
                                                    WHEN 'collected' THEN 'Collected.' END), v_me_name, 'staff');
  INSERT INTO public.audit_logs (user_id, actor, actor_type, action, entity_type, entity_id, result, risk_level, details)
  VALUES (v_me, v_me_name, 'human', 'request_' || p_action, 'service_requests', p_id, 'success', 'low',
          jsonb_build_object('request', v_r.request_number, 'form', v_t.title, 'status', v_status));
  INSERT INTO public.notifications (user_id, type, title, link)
  VALUES (v_owner, 'request_update', left(v_msg, 120), '/account/requests/' || p_id);

  RETURN jsonb_build_object('status', v_status, 'outcome', v_outcome);
END $$;
REVOKE EXECUTE ON FUNCTION public.staff_update_service_request(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.staff_update_service_request(uuid, text, text) TO authenticated;
