-- 029_instant_letters.sql
-- Digital enrolment letters are issued instantly (no staff click needed).
-- Safe to run more than once. Run after 026.

CREATE OR REPLACE FUNCTION public.submit_service_request(p_type text, p_details jsonb, p_photo text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_cust    uuid := private.require_customer();
  v_user    uuid := private.my_user_id();
  v_t       public.request_types;
  v_check   jsonb;
  v_d       jsonb;
  v_prefill jsonb;
  v_open    text;
  v_order   uuid;
  v_req     uuid;
  v_num     text;
  v_needs_photo boolean;
BEGIN
  SELECT * INTO v_t FROM public.request_types WHERE type_key = p_type AND active AND industry = public.current_industry();
  IF NOT FOUND THEN RAISE EXCEPTION 'That form is not available.' USING ERRCODE = '22023'; END IF;

  -- one open request of each kind at a time (stops double sends)
  SELECT request_number INTO v_open FROM public.service_requests
  WHERE customer_id = v_cust AND type_key = p_type AND status IN ('submitted', 'in_review', 'needs_info')
    AND (p_type <> 'delivery_address' OR details->>'order' = p_details->>'order')
  LIMIT 1;
  IF v_open IS NOT NULL THEN
    RAISE EXCEPTION 'You already have this request in progress (%). You can follow it in My requests.', v_open USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(*) FROM public.service_requests WHERE customer_id = v_cust AND created_at > now() - interval '10 minutes') >= 5 THEN
    RAISE EXCEPTION 'You have sent several requests in the last few minutes. Please wait a little.' USING ERRCODE = '22023';
  END IF;

  v_prefill := private.request_prefill(v_cust);
  v_check := private.check_request_details(v_t.fields, COALESCE(p_details, '{}'::jsonb), v_prefill);
  IF NOT (v_check->>'ok')::boolean THEN RAISE EXCEPTION '%', v_check->>'message' USING ERRCODE = '22023'; END IF;
  v_d := v_check->'details';

  -- the photo must be the person's own upload
  v_needs_photo := EXISTS (SELECT 1 FROM jsonb_array_elements(v_t.fields) f WHERE f->>'type' = 'photo' AND (f->>'required')::boolean);
  IF p_photo IS NOT NULL AND p_photo <> '' THEN
    IF p_photo !~ ('^' || (SELECT auth.uid())::text || '/[A-Za-z0-9-]+\.(jpg|jpeg|png|webp)$')
       OR NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'request-photos' AND o.name = p_photo) THEN
      RAISE EXCEPTION 'Your photo did not upload correctly. Please add it again.' USING ERRCODE = '22023';
    END IF;
  ELSIF v_needs_photo THEN
    RAISE EXCEPTION 'Please add your photo.' USING ERRCODE = '22023';
  END IF;

  -- form-specific checks
  IF p_type = 'delivery_address' THEN
    IF NOT private.postcode_matches_state(v_d->>'postcode', v_d->>'state') THEN
      RAISE EXCEPTION 'Postcode % is not in %. Please check the postcode and state.', v_d->>'postcode', v_d->>'state' USING ERRCODE = '22023';
    END IF;
    SELECT order_id INTO v_order FROM public.orders
    WHERE order_number = v_d->>'order' AND customer_id = v_cust AND status IN ('placed', 'processing');
    IF v_order IS NULL THEN RAISE EXCEPTION 'That order has already shipped, so its address cannot be changed.' USING ERRCODE = '22023'; END IF;
  END IF;

  INSERT INTO public.service_requests (type_key, customer_id, industry, details, photo_path, order_id, due_at)
  VALUES (p_type, v_cust, v_t.industry, v_d, NULLIF(p_photo, ''), v_order, now() + make_interval(hours => v_t.sla_hours))
  RETURNING request_id, request_number INTO v_req, v_num;

  INSERT INTO public.service_request_events (request_id, status, note, actor_name, actor_type)
  VALUES (v_req, 'submitted', 'Form sent. All details checked.', (SELECT name FROM public.users WHERE user_id = v_user), 'person');
  INSERT INTO public.audit_logs (user_id, actor, actor_type, action, entity_type, entity_id, result, risk_level, details)
  VALUES (v_user, CASE WHEN v_t.industry = 'university' THEN 'Student' ELSE 'Customer' END, 'human', 'request_submitted',
          'service_requests', v_req, 'success', 'low', jsonb_build_object('request', v_num, 'form', v_t.title, 'team', v_t.team_name));
  -- 029: a digital enrolment letter only confirms what the student record already shows,
  -- so the system issues it straight away. A printed copy still goes to the Student Centre.
  IF p_type = 'enrolment_letter' AND v_d->>'delivery' = 'Digital letter (PDF)' THEN
    UPDATE public.service_requests SET
      status = 'completed', updated_at = now(), ready_at = now(), completed_at = now(),
      outcome = outcome || jsonb_build_object('reference', 'EL-' || substr(v_num, 4), 'issued', current_date,
                                              'issued_by', 'Student Records System')
    WHERE request_id = v_req;
    INSERT INTO public.service_request_events (request_id, status, note, actor_name, actor_type)
    VALUES (v_req, 'completed', 'Issued automatically. Enrolment confirmed from the student record.', 'NexusCX', 'system');
    INSERT INTO public.notifications (user_id, type, title, link)
    VALUES (v_user, 'request_update', left(v_num || ': your enrolment letter is ready', 120), '/account/requests/' || v_req);
    RETURN jsonb_build_object('request_id', v_req, 'request_number', v_num, 'team', v_t.team_name,
                              'sla_hours', v_t.sla_hours, 'status', 'completed');
  END IF;

  PERFORM private.notify_request_team(v_req, v_num || ': new ' || v_t.title || ' request');

  RETURN jsonb_build_object('request_id', v_req, 'request_number', v_num, 'team', v_t.team_name, 'sla_hours', v_t.sla_hours, 'status', 'submitted');
END $$;
REVOKE EXECUTE ON FUNCTION public.submit_service_request(text, jsonb, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.submit_service_request(text, jsonb, text) TO authenticated;
