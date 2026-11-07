-- 030_batch1.sql  (run after 029)
-- 1. Holiday letter and course completion letter: issued instantly by the university's own rules.
--    - Holiday letter: confirms the official break dates. Travel dates outside the break are refused
--      with a clear reason (missing classes needs a leave of absence, which a person decides).
--    - Completion letter: only for a course whose expected end date has passed.
-- 2. Product safety (online store): "it burned me", "caught fire", "allergic reaction"...
--    is a HARD STOP like wellbeing: never answered by AI, sent to a person as urgent,
--    with clear safety advice, and counted in the duty-of-care report.
-- Safe to run more than once.

-- ---------- course end date (same rule as the website: Bachelor 3 years, Master 2, Diploma 1; part-time doubles) ----------
CREATE OR REPLACE FUNCTION private.course_end(p_course text, p_intake text, p_load text)
RETURNS date LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  v_years int := (CASE WHEN p_course LIKE 'Bachelor%' THEN 3 WHEN p_course LIKE 'Master%' THEN 2 ELSE 1 END)
                 * CASE WHEN p_load = 'Part-time' THEN 2 ELSE 1 END;
  v_month text := split_part(COALESCE(p_intake, ''), ' ', 1);
  v_year  int;
BEGIN
  IF split_part(COALESCE(p_intake, ''), ' ', 2) !~ '^[0-9]{4}$' THEN RETURN NULL; END IF;
  v_year := split_part(p_intake, ' ', 2)::int;
  RETURN CASE WHEN v_month = 'July' THEN make_date(v_year + v_years, 6, 30) ELSE make_date(v_year + v_years - 1, 11, 30) END;
END $$;
REVOKE ALL ON FUNCTION private.course_end(text, text, text) FROM public, anon, authenticated;

-- ---------- Northbridge break dates (fictional academic calendar) ----------
CREATE OR REPLACE FUNCTION private.break_dates(p_break text)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE
    WHEN p_break LIKE 'Summer break%'        THEN '{"name":"summer break","from":"2026-11-21","to":"2027-02-21","resume":"2027-02-22"}'
    WHEN p_break LIKE 'Mid-semester break%'  THEN '{"name":"mid-semester break","from":"2027-04-05","to":"2027-04-11","resume":"2027-04-12"}'
    WHEN p_break LIKE 'Mid-year break%'      THEN '{"name":"mid-year break","from":"2027-06-26","to":"2027-07-25","resume":"2027-07-26"}'
  END::jsonb
$$;
REVOKE ALL ON FUNCTION private.break_dates(text) FROM public, anon, authenticated;

-- ---------- the two new forms ----------
INSERT INTO public.request_types (type_key, industry, title, summary, team_name, icon, keywords, fields, sla_hours, fee_note, sort) VALUES
('holiday_letter', 'university', 'Holiday letter',
 'A letter confirming the official university break dates, for travel, an employer or a visa. Issued instantly.',
 'Student Centre', 'letter',
 'holiday letter|(holiday|break|travel) (confirmation )?letter|letter .*\b(holidays?|break|travel)\b|(semester|summer|mid.?year|uni(versity)?) (break|holidays?)|break dates|going (home|overseas|back home) (for|during|in) the (break|holidays?)',
 '[
   {"name":"full_name","label":"Full name","type":"text","required":true,"prefill":"name","readonly":true},
   {"name":"student_number","label":"Student number","type":"text","required":true,"prefill":"student_number","readonly":true},
   {"name":"course","label":"Course","type":"select","required":true,"options":["Bachelor of Information Technology","Bachelor of Business","Bachelor of Nursing","Diploma of Information Technology","Master of Information Technology","Master of Business Administration"]},
   {"name":"load","label":"Study load","type":"select","required":true,"options":["Full-time","Part-time"]},
   {"name":"break","label":"Which break?","type":"select","required":true,"options":["Summer break (21 Nov 2026 to 21 Feb 2027)","Mid-semester break (5 to 11 Apr 2027)","Mid-year break (26 Jun to 25 Jul 2027)"]},
   {"name":"leaving","label":"Leaving on (optional)","type":"date","required":false,"help":"If you add travel dates, they must fit inside the break."},
   {"name":"returning","label":"Back on (optional)","type":"date","required":false},
   {"name":"purpose","label":"What is the letter for?","type":"select","required":true,"options":["Travel overseas","Employer (working during the break)","Student visa or immigration","Family","Other"]},
   {"name":"addressed_to","label":"Addressed to (optional)","type":"text","required":false,"max":100,"help":"Leave blank for \"To whom it may concern\"."},
   {"name":"confirm","label":"I confirm these details are correct","type":"checkbox","required":true}
 ]', 24, 'Holiday letters are free and issued instantly.', 3),
('completion_letter', 'university', 'Course completion letter',
 'A letter confirming you have finished your course, for jobs or further study. Issued instantly once your course has ended.',
 'Student Centre', 'letter',
 'completion letter|letter of completion|(course|degree) completion|(completed|finished) (my )?(course|degree|studies|diploma|bachelor|master)|proof (of|that i) (completion|completed|finished|graduat)|graduat\w* letter',
 '[
   {"name":"full_name","label":"Full name","type":"text","required":true,"prefill":"name","readonly":true},
   {"name":"student_number","label":"Student number","type":"text","required":true,"prefill":"student_number","readonly":true},
   {"name":"course","label":"Course","type":"select","required":true,"options":["Bachelor of Information Technology","Bachelor of Business","Bachelor of Nursing","Diploma of Information Technology","Master of Information Technology","Master of Business Administration"]},
   {"name":"intake","label":"When did you start this course?","type":"select","required":true,"options":["February 2020","July 2020","February 2021","July 2021","February 2022","July 2022","February 2023","July 2023","February 2024","July 2024","February 2025","July 2025","February 2026","July 2026"]},
   {"name":"load","label":"Study load","type":"select","required":true,"options":["Full-time","Part-time"]},
   {"name":"purpose","label":"What is the letter for?","type":"select","required":true,"options":["Job application","Further study","Professional registration","Student visa or immigration","Other"]},
   {"name":"addressed_to","label":"Addressed to (optional)","type":"text","required":false,"max":100,"help":"Leave blank for \"To whom it may concern\"."},
   {"name":"confirm","label":"I confirm these details are correct","type":"checkbox","required":true}
 ]', 24, 'Completion letters are free and issued instantly.', 4)
ON CONFLICT (type_key) DO UPDATE SET industry = EXCLUDED.industry, title = EXCLUDED.title, summary = EXCLUDED.summary,
  team_name = EXCLUDED.team_name, icon = EXCLUDED.icon, keywords = EXCLUDED.keywords, fields = EXCLUDED.fields,
  sla_hours = EXCLUDED.sla_hours, fee_note = EXCLUDED.fee_note, sort = EXCLUDED.sort, active = true;


-- ---------- instant letters (submit_service_request, from 029) ----------
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
  v_end     date;
  v_break   jsonb;
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

  -- 030: rules for the instant letters
  IF p_type = 'completion_letter' THEN
    v_end := private.course_end(v_d->>'course', v_d->>'intake', v_d->>'load');
    IF v_end IS NULL OR v_end >= current_date THEN
      RAISE EXCEPTION 'Your course is expected to finish in %. A completion letter can be issued after that. You can get an enrolment letter now instead.',
        to_char(v_end, 'FMMonth YYYY') USING ERRCODE = '22023';
    END IF;
  ELSIF p_type = 'holiday_letter' THEN
    v_break := private.break_dates(v_d->>'break');
    IF v_break IS NULL THEN RAISE EXCEPTION 'Please choose one of the breaks.' USING ERRCODE = '22023'; END IF;
    IF NULLIF(v_d->>'leaving', '') IS NOT NULL OR NULLIF(v_d->>'returning', '') IS NOT NULL THEN
      IF NULLIF(v_d->>'leaving', '') IS NULL OR NULLIF(v_d->>'returning', '') IS NULL THEN
        RAISE EXCEPTION 'Please add both travel dates, or leave both empty.' USING ERRCODE = '22023';
      END IF;
      IF (v_d->>'returning')::date < (v_d->>'leaving')::date THEN
        RAISE EXCEPTION 'Your return date is before your leaving date. Please check the dates.' USING ERRCODE = '22023';
      END IF;
      IF (v_d->>'leaving')::date < (v_break->>'from')::date THEN
        RAISE EXCEPTION 'You would leave on %, before the % starts on %. Missing classes needs a leave of absence, which Student Services decides. Please ask in the chat.',
          to_char((v_d->>'leaving')::date, 'FMDD FMMonth YYYY'), v_break->>'name', to_char((v_break->>'from')::date, 'FMDD FMMonth YYYY') USING ERRCODE = '22023';
      END IF;
      IF (v_d->>'returning')::date > (v_break->>'to')::date THEN
        RAISE EXCEPTION 'You would be back on %, but classes start again on %. Missing classes needs a leave of absence, which Student Services decides. Please ask in the chat.',
          to_char((v_d->>'returning')::date, 'FMDD FMMonth YYYY'), to_char((v_break->>'resume')::date, 'FMDD FMMonth YYYY') USING ERRCODE = '22023';
      END IF;
    END IF;
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
  IF (p_type = 'enrolment_letter' AND v_d->>'delivery' = 'Digital letter (PDF)') OR p_type IN ('holiday_letter', 'completion_letter') THEN
    UPDATE public.service_requests SET
      status = 'completed', updated_at = now(), ready_at = now(), completed_at = now(),
      outcome = outcome || jsonb_build_object('reference', CASE p_type WHEN 'holiday_letter' THEN 'HL-' WHEN 'completion_letter' THEN 'CL-' ELSE 'EL-' END || substr(v_num, 4),
                                              'issued', current_date, 'issued_by', 'Student Records System')
                        || CASE WHEN p_type = 'holiday_letter' THEN jsonb_build_object('break_name', v_break->>'name',
                                 'break_from', v_break->>'from', 'break_to', v_break->>'to', 'resume', v_break->>'resume')
                                WHEN p_type = 'completion_letter' THEN jsonb_build_object('completed', v_end)
                                ELSE '{}'::jsonb END
    WHERE request_id = v_req;
    INSERT INTO public.service_request_events (request_id, status, note, actor_name, actor_type, created_at)
    VALUES (v_req, 'completed', 'Issued automatically. Checked against the student record and the university rules.', 'NexusCX', 'system', clock_timestamp());
    INSERT INTO public.notifications (user_id, type, title, link)
    VALUES (v_user, 'request_update', left(v_num || ': your ' || lower(v_t.title) || ' is ready', 120), '/account/requests/' || v_req);
    RETURN jsonb_build_object('request_id', v_req, 'request_number', v_num, 'team', v_t.team_name,
                              'sla_hours', v_t.sla_hours, 'status', 'completed');
  END IF;

  PERFORM private.notify_request_team(v_req, v_num || ': new ' || v_t.title || ' request');

  RETURN jsonb_build_object('request_id', v_req, 'request_number', v_num, 'team', v_t.team_name, 'sla_hours', v_t.sla_hours, 'status', 'submitted');
END $$;
REVOKE EXECUTE ON FUNCTION public.submit_service_request(text, jsonb, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.submit_service_request(text, jsonb, text) TO authenticated;


-- ---------- product safety in the classifier (from 027) ----------
CREATE OR REPLACE FUNCTION private.classify_enquiry(p_text text, p_industry text, p_paused uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_industry    text := p_industry;
  v_uni         boolean;
  v_text        text := trim(COALESCE(p_text, ''));
  v_low         text;
  v_lang        text;
  v_intent      text := 'unknown';
  v_hits        int  := 0;
  v_sentiment   text := 'neutral';
  v_urgency     text := 'medium';
  v_risk        text := 'low';
  v_conf        numeric(4,3);
  v_priority    text;
  v_injection   boolean;
  v_sensitive   boolean := false;
  v_flag        text;              -- university safety reason: wellbeing, visa, integrity, ...
  v_dept        text;              -- department name for the reply
  v_agent_id    uuid;
  v_agent_name  text;
  v_threshold   numeric := 0.70;
  v_rule        record;
  v_esc_id      uuid;
  v_esc_name    text;
  v_case_id     uuid;
  v_case_number text;
  v_conv_id     uuid;
  v_msg_id      uuid;
  v_reply_id    uuid;
  v_doc_id      uuid;
  v_doc_title   text;
  v_doc_version text;
  v_doc_content text;
  v_query       tsquery;
  v_cat         text;
  v_words       text;
  v_reply       text;
  v_status      text := 'ai_handling';
  v_sla_minutes int;
  v_lang_name   text;
  v_title_hit   boolean;
  v_kw_hits     int;
BEGIN
  v_uni  := v_industry = 'university';
  v_low  := lower(v_text);
  v_lang := private.detect_language(v_text);

  -- ---------- classify (rule-based keywords) ----------
  v_injection := v_low ~ '(ignore (all |your |the )?(previous|prior) instructions|system prompt|reveal (your|the|internal)|act as (an? )?admin|jailbreak)';

  IF v_uni THEN
    -- University departments. Order matters: safety topics first.
    IF v_low ~ '(suicid|self.?harm|kill myself|end my life|hurt myself|can.?t cope|cannot cope|not coping|struggling to cope|unable to cope|can.?t handle (it|this|anything)|breaking down|hopeless|can.?t go on|give up on (life|everything)|no one to talk to|so lonely|feel(ing)? (so )?alone|overwhelmed|so stressed|really stressed|anxious|anxiety|depress|mental health|panic attack|not safe)' THEN
      v_intent := 'student_services'; v_flag := 'wellbeing';
    ELSIF v_low ~ '(visa|coe\M|confirmation of enrolment|oshc|health cover|home affairs|subclass|work rights)' THEN
      v_intent := 'student_services';
      IF v_low ~ '(my visa|visa (cancel|refus|extension|expir|breach)|can i (work|stay|travel)|breach|condition 8[0-9]{3}|will i lose|deport)' THEN v_flag := 'visa'; END IF;
    ELSIF v_low ~ '(special consideration|academic integrity|plagiarism|misconduct|grade appeal|appeal (my|a|the) (grade|mark|result)|review of grade|grade review|remark|re-mark|cheat)' THEN
      v_intent := 'academic'; v_flag := 'academic';
    ELSIF v_low ~ '(password|log ?in|sign ?in|wi-?fi|eduroam|moodle|\mlms\M|student email|outlook|microsoft|office 365|\mmfa\M|authenticator|printer|printing|\mvpn\M|portal (not|isn)|hacked|locked out)' THEN
      v_intent := 'it_support';
      IF v_low ~ '(hacked|compromised|phishing|someone (else )?(logged|used) my)' THEN v_flag := 'security'; END IF;
    ELSIF v_low ~ '(\mfees?\M|tuition|payment plan|\mpay\M|paying|invoice|statement of account|scholarship|bursary|refund|\mdebt\M|hecs|help loan|financial hardship|bpay)' THEN
      v_intent := 'fees';
      IF v_low ~ '(hardship|\mdebt\M|cannot afford|can.?t afford|sanction|(want|need|request|get|give me) (a |my )?(fee )?refund)' THEN v_flag := 'finance'; END IF;
    ELSIF v_low ~ '(apply|application|admission|entry requirement|\moffer\M|intake|\matar\M|prerequisite|ielts|\mpte\M|credit transfer|recognition of prior|advanced standing|defer my offer)' THEN
      v_intent := 'admissions';
    ELSIF v_low ~ '(\mexams?\M|results?\M|\mgrades?\M|\mmarks?\M|transcript|timetable|enrol|census|\munits?\M|subject|assignment|extension|special consideration|deferred|supplementary|academic integrity|plagiarism|misconduct|appeal|cheat|graduat|lecture|tutorial|study plan)' THEN
      v_intent := 'academic';
      IF v_low ~ '(special consideration|academic integrity|plagiarism|misconduct|appeal|cheat|review of grade|grade review|remark|re-mark|failed .*unfair)' THEN v_flag := 'academic'; END IF;
    ELSIF v_low ~ '(id card|student card|\mcard\M|lost my card|international student|orientation|accommodation|housing|where (can|do|should) i (live|stay)|place to (live|stay)|\mrent\M|career|resume|\mcv\M|internship|library|study room|\mclub|disability|access plan|parking|counsel|complaint|wellbeing)' THEN
      v_intent := 'student_services';
      IF v_low ~ '(disability|access plan|complaint)' THEN v_flag := 'support'; END IF;
    END IF;
    v_hits := (SELECT count(*) FROM regexp_matches(v_low,
      '(visa|password|wi-?fi|moodle|email|fee|tuition|pay|scholarship|refund|apply|application|offer|intake|exam|result|grade|transcript|timetable|enrol|census|unit|assignment|extension|card|accommodation|career|stress)', 'g'));
  ELSE
    -- E-commerce. 030: product safety first, before anything else.
    IF v_low ~ '(caught fire|on fire|\mfire\M|burn(ed|t|s|ing)? (me|my|him|her|us|them|the|a)|burnt|\mburns?\M|smok(e|ing)\M|melt(ed|ing)|explod|exploded|overheat|electric(al)? shock|shocked (me|my)|sparks?\M|injur|hurt (me|my|him|her|us|them)|\mcut (me|my|him|her)|bleed|allergic|allergy|anaphyla|\mrash\M|swell|chok(e|ed|ing)|poison|swallow|unsafe|dangerous|product recall|been recalled)' THEN
      v_intent := 'product_safety'; v_flag := 'product_safety';
    ELSIF v_low ~ '(refund|charged twice|double charge|money back|chargeback)' THEN
      v_intent := 'refund_request';
    ELSIF v_low ~ '(invoice|bill|billing|payment|charge|subscription|price)' THEN
      v_intent := 'billing_question';
    ELSIF v_low ~ '(return|exchange|send it back)' THEN
      v_intent := 'return_request';
    ELSIF v_low ~ '(order|delivery|deliver|parcel|package|shipping|tracking|arrive)' THEN
      v_intent := 'order_status';
    ELSIF v_low ~ '(log ?in|password|crash|error|bug|app|website|not working|reset)' THEN
      v_intent := 'technical_issue';
    ELSIF v_low ~ '(account|email address|username|profile|close my)' THEN
      v_intent := 'account';
    END IF;
    v_hits := (SELECT count(*) FROM regexp_matches(v_low,
               '(refund|invoice|bill|payment|charge|order|delivery|parcel|return|log ?in|password|crash|error|account)', 'g'));
  END IF;
  v_conf := CASE WHEN v_intent = 'unknown' THEN 0.400 WHEN v_hits >= 2 THEN 0.920 ELSE 0.780 END;

  IF v_low ~ '(furious|ridiculous|unacceptable|worst|disgusting|angry|scam|!!)' THEN v_sentiment := 'angry';
  ELSIF v_low ~ '(wrong|not working|cannot|can''t|didn''t|problem|issue|broken|still|stressed|worried|anxious)' THEN v_sentiment := 'negative';
  ELSIF v_low ~ '(thanks|thank you|great|love|happy)' THEN v_sentiment := 'positive';
  END IF;

  IF v_low ~ '(urgent|asap|immediately|right now|emergency)' OR v_flag IN ('wellbeing', 'product_safety') THEN v_urgency := 'critical';
  ELSIF v_sentiment IN ('angry','negative') THEN v_urgency := 'high';
  ELSIF v_intent = 'unknown' THEN v_urgency := 'low';
  END IF;

  IF v_uni THEN
    v_sensitive := v_flag IS NOT NULL OR v_low ~ '(legal|lawyer|delete my account)';
  ELSE
    v_sensitive := v_intent = 'refund_request' OR v_flag = 'product_safety'
                OR v_low ~ '(change my (bank|card|account)|delete my account|close my account|legal|lawyer)';
  END IF;
  v_risk := CASE WHEN v_injection THEN 'critical' WHEN v_sensitive THEN 'high'
                 WHEN v_sentiment = 'angry' THEN 'medium' ELSE 'low' END;
  v_priority := CASE WHEN v_flag IN ('wellbeing', 'product_safety') THEN 'urgent'
                     WHEN v_risk IN ('critical','high') OR v_urgency = 'critical' THEN 'high'
                     WHEN v_urgency = 'high' THEN 'medium'
                     WHEN v_intent = 'unknown' THEN 'low' ELSE 'normal' END;

  SELECT (value #>> '{}')::numeric INTO v_threshold FROM public.platform_settings WHERE setting_key = 'confidence_threshold';
  v_threshold := COALESCE(v_threshold, 0.70);

  -- ---------- find the best approved article in THIS pack's knowledge base ----------
  -- (English articles only: other languages go to a person who can help in that language)
  IF v_uni THEN
    v_cat := CASE WHEN v_intent IN ('admissions','fees','it_support','academic','student_services') THEN v_intent END;
  ELSE
    v_cat := CASE WHEN v_intent IN ('order_status','return_request') THEN 'orders'
                  WHEN v_intent IN ('billing_question','refund_request') THEN 'billing'
                  WHEN v_intent = 'technical_issue' THEN 'technical'
                  WHEN v_intent = 'account' THEN 'account' END;
  END IF;
  -- Words that say nothing about the topic are left out, so "Where can students
  -- park on campus?" does not match the Wi-Fi article just because of "campus".
  v_words := array_to_string(ARRAY(SELECT DISTINCT w FROM regexp_split_to_table(v_low, '[^a-z0-9]+') w
               WHERE length(w) >= 2 AND w NOT IN ('student','students','university','uni','northbridge','campus','semester',
                     'please','thanks','thank','time','day','week','weekend','weekends','much','many',
                     -- everyday words that say nothing about the topic
                     'bring','room','rooms','open','close','closes','get','need','use','find','know','people','guests')), ' or ');
  IF v_words <> '' AND v_lang = 'en' THEN
    v_query := websearch_to_tsquery('english', v_words);
    -- the answer ends with who to contact (the article's own contact, or its department's)
    SELECT d.document_id, d.title, d.version,
           d.content || COALESCE(E'\n\nWho to contact: ' || COALESCE(d.contact_role, p.role) || ', ' || COALESCE(d.contact_email, p.email)
                                 || COALESCE(' (' || p.hours || ')', ''), '')
      INTO v_doc_id, v_doc_title, v_doc_version, v_doc_content
    FROM public.knowledge_documents d
    LEFT JOIN public.departments p ON p.industry = d.industry AND p.category = d.category
    WHERE d.status = 'approved' AND d.industry = v_industry AND d.search @@ v_query
      -- the article's title or keywords must share a word with the question (not just its body text)
      AND to_tsvector('english', d.title || ' ' || d.keywords) @@ v_query
    ORDER BY ts_rank(d.search, v_query) + CASE WHEN d.category = v_cat THEN 0.3 ELSE 0 END DESC, d.updated_at DESC
    LIMIT 1;
  END IF;

  -- The best article is from another topic, or the question has no topic word:
  -- only trust a strong match (a word in the article's title, two of its keywords,
  -- or a general article). Otherwise a person answers instead of a wrong article.
  IF v_doc_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.knowledge_documents d WHERE d.document_id = v_doc_id AND (
         d.category IS NOT DISTINCT FROM v_cat OR
         d.category = 'general' OR to_tsvector('english', d.title) @@ v_query
         OR (SELECT count(*) FROM regexp_split_to_table(replace(v_words, ' or ', ' '), ' ') w
             WHERE CASE WHEN length(to_tsvector('english', w)) > 0   -- skip words like "the" (no notices)
                        THEN to_tsvector('english', d.keywords) @@ plainto_tsquery('english', w) ELSE false END) >= 2)) THEN
    v_doc_id := NULL; v_doc_title := NULL; v_doc_version := NULL; v_doc_content := NULL;
  END IF;

  -- No keyword topic, but a help article matched: take the topic from the article
  IF v_intent = 'unknown' AND v_doc_id IS NOT NULL THEN
    SELECT CASE WHEN v_uni THEN category
                ELSE CASE category WHEN 'orders' THEN 'order_status' WHEN 'billing' THEN 'billing_question'
                     WHEN 'technical' THEN 'technical_issue' WHEN 'account' THEN 'account' ELSE 'general' END END
    INTO v_intent FROM public.knowledge_documents WHERE document_id = v_doc_id;
    v_conf := 0.750;
    IF v_urgency = 'low' THEN v_urgency := 'medium'; END IF;
    v_priority := CASE WHEN v_priority = 'low' THEN 'normal' ELSE v_priority END;
  END IF;

  -- How sure are we? Based on how well the article matches the question:
  -- a word in its title and its keywords = very sure; keywords only = sure.
  IF v_doc_id IS NOT NULL THEN
    SELECT (to_tsvector('english', d.title) @@ v_query),
           (SELECT count(*) FROM regexp_split_to_table(replace(v_words, ' or ', ' '), ' ') w
            WHERE CASE WHEN length(to_tsvector('english', w)) > 0
                       THEN to_tsvector('english', d.keywords) @@ plainto_tsquery('english', w) ELSE false END)
    INTO v_title_hit, v_kw_hits FROM public.knowledge_documents d WHERE d.document_id = v_doc_id;
    v_conf := GREATEST(v_conf, CASE WHEN v_title_hit AND v_kw_hits >= 2 THEN 0.960
                                    WHEN v_title_hit OR v_kw_hits >= 2 THEN 0.920
                                    WHEN v_kw_hits = 1 THEN 0.860
                                    ELSE v_conf END);
  END IF;

  -- ---------- route (first matching active rule in this pack) ----------
  SELECT r.agent_id, a.name, a.department INTO v_agent_id, v_agent_name, v_dept
  FROM public.routing_rules r JOIN public.ai_agents a ON a.agent_id = r.agent_id
  WHERE r.status = 'active' AND r.action = 'route_to_agent' AND r.intent = v_intent AND a.status = 'active'
    AND a.agent_id IS DISTINCT FROM p_paused
    AND r.industry IN ('all', v_industry) AND a.industry IN ('all', v_industry)
  ORDER BY r.priority LIMIT 1;
  IF v_uni AND v_dept IS NULL THEN
    v_dept := CASE v_intent WHEN 'admissions' THEN 'Admissions' WHEN 'fees' THEN 'Student Finance'
                WHEN 'it_support' THEN 'IT Service Desk' WHEN 'academic' THEN 'Academic Services'
                ELSE 'Student Services' END;
  END IF;
  IF v_flag = 'product_safety' THEN v_dept := 'Product Safety';
  ELSIF v_flag = 'wellbeing' THEN v_dept := 'Student Wellbeing';
  ELSIF v_flag = 'visa' THEN v_dept := 'International Student Advisers';
  END IF;

  RETURN jsonb_build_object(
    'industry', v_industry, 'uni', v_uni, 'text', v_text, 'language', v_lang,
    'intent', v_intent, 'sentiment', v_sentiment, 'urgency', v_urgency, 'risk', v_risk,
    'confidence', v_conf, 'priority', v_priority, 'injection', v_injection, 'sensitive', v_sensitive,
    'flag', v_flag, 'department', v_dept, 'agent_id', v_agent_id, 'agent_name', v_agent_name,
    'doc_id', v_doc_id, 'doc_title', v_doc_title, 'doc_version', v_doc_version, 'doc_content', v_doc_content,
    'asks_human', v_low ~ '(human|real person|speak to (an? )?(agent|someone))',
    -- the one reason a case is sensitive, for the duty-of-care report
    'safety_flag', COALESCE(CASE WHEN v_injection THEN 'injection' END, v_flag,
                     CASE WHEN v_sensitive AND v_intent = 'refund_request' THEN 'refund'
                          WHEN v_sensitive THEN 'account_change' END));
END $$;
REVOKE ALL ON FUNCTION private.classify_enquiry(text, text, uuid) FROM public, anon, authenticated;


-- ---------- product safety is a hard stop (from 019) ----------
CREATE OR REPLACE FUNCTION private.pick_escalation(c jsonb, p_threshold numeric DEFAULT NULL,
  p_angry boolean DEFAULT NULL, p_high_risk boolean DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_rule    record;
  v_default numeric := COALESCE((SELECT (value #>> '{}')::numeric FROM public.platform_settings WHERE setting_key = 'confidence_threshold'), 0.70);
  v_on      boolean;
BEGIN
  FOR v_rule IN SELECT * FROM public.escalation_rules ORDER BY (condition_type = 'prompt_injection') DESC, priority LOOP
    v_on := CASE WHEN v_rule.condition_type = 'sentiment_equals' AND p_angry IS NOT NULL THEN p_angry
                 WHEN v_rule.condition_type = 'risk_equals' AND p_high_risk IS NOT NULL THEN p_high_risk
                 ELSE v_rule.status = 'active' END;
    CONTINUE WHEN NOT v_on;
    IF (v_rule.condition_type = 'prompt_injection'        AND (c->>'injection')::boolean)
    OR (v_rule.condition_type = 'risk_equals'             AND c->>'risk' = v_rule.threshold_value)
    OR (v_rule.condition_type = 'sensitive_action'        AND (c->>'sensitive')::boolean)
    OR (v_rule.condition_type = 'sentiment_equals'        AND c->>'sentiment' = v_rule.threshold_value)
    OR (v_rule.condition_type = 'urgency_equals'          AND c->>'urgency' = v_rule.threshold_value)
    OR (v_rule.condition_type = 'confidence_below'        AND (c->>'confidence')::numeric < COALESCE(p_threshold, v_rule.threshold_value::numeric, v_default))
    OR (v_rule.condition_type = 'customer_requests_human' AND (c->>'asks_human')::boolean)
    OR (v_rule.condition_type = 'agent_cannot_answer'     AND (c->>'agent_id' IS NULL OR c->>'doc_id' IS NULL)) THEN
      RETURN jsonb_build_object('rule_id', v_rule.rule_id, 'name', v_rule.name, 'hard_stop', false);
    END IF;
  END LOOP;
  -- Hard stops: wellbeing, personal visa questions and product safety ALWAYS go to a person, whatever the settings
  IF c->>'flag' IN ('wellbeing', 'visa', 'product_safety') THEN
    RETURN (SELECT jsonb_build_object('rule_id', rule_id, 'name', name, 'hard_stop', true)
            FROM public.escalation_rules WHERE condition_type = 'sensitive_action')
           || '{"hard_stop": true}'::jsonb;
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.pick_escalation(jsonb, numeric, boolean, boolean) FROM public, anon, authenticated;


-- ---------- safety reply in the first answer (from 019) ----------
CREATE OR REPLACE FUNCTION private.handle_enquiry(p_customer uuid, p_user uuid, p_message text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_industry    text := public.current_industry();
  v_uni         boolean;
  v_text        text := trim(COALESCE(p_message, ''));
  v_low         text;
  v_lang        text;
  v_intent      text := 'unknown';
  v_hits        int  := 0;
  v_sentiment   text := 'neutral';
  v_urgency     text := 'medium';
  v_risk        text := 'low';
  v_conf        numeric(4,3);
  v_priority    text;
  v_injection   boolean;
  v_sensitive   boolean := false;
  v_flag        text;              -- university safety reason: wellbeing, visa, integrity, ...
  v_dept        text;              -- department name for the reply
  v_agent_id    uuid;
  v_agent_name  text;
  v_threshold   numeric := 0.70;
  v_rule        record;
  v_esc_id      uuid;
  v_esc_name    text;
  v_case_id     uuid;
  v_case_number text;
  v_conv_id     uuid;
  v_msg_id      uuid;
  v_reply_id    uuid;
  v_doc_id      uuid;
  v_doc_title   text;
  v_doc_version text;
  v_doc_content text;
  v_query       tsquery;
  v_cat         text;
  v_words       text;
  v_reply       text;
  v_status      text := 'ai_handling';
  v_sla_minutes int;
  v_lang_name   text;
  v_c           jsonb;
  v_esc         jsonb;
BEGIN
  v_uni  := v_industry = 'university';
  v_low  := lower(v_text);
  -- 1. understand the message (no changes made)
  v_c := private.classify_enquiry(v_text, v_industry);
  v_lang := v_c->>'language'; v_intent := v_c->>'intent'; v_sentiment := v_c->>'sentiment';
  v_urgency := v_c->>'urgency'; v_risk := v_c->>'risk'; v_conf := (v_c->>'confidence')::numeric;
  v_priority := v_c->>'priority'; v_injection := (v_c->>'injection')::boolean; v_sensitive := (v_c->>'sensitive')::boolean;
  v_flag := v_c->>'flag'; v_dept := v_c->>'department'; v_agent_id := (v_c->>'agent_id')::uuid; v_agent_name := v_c->>'agent_name';
  v_doc_id := (v_c->>'doc_id')::uuid; v_doc_title := v_c->>'doc_title'; v_doc_version := v_c->>'doc_version'; v_doc_content := v_c->>'doc_content';


  -- ---------- create case, conversation, customer message ----------
  SELECT resolution_minutes INTO v_sla_minutes FROM public.sla_policies WHERE priority = v_priority;
  INSERT INTO public.cases (customer_id, status, priority, intent, sentiment, urgency, risk, confidence,
                            subject, assigned_agent_id, sla_due_at, language, industry, safety_flag)
  VALUES (p_customer, 'ai_handling', v_priority, v_intent, v_sentiment, v_urgency, v_risk, v_conf,
          left(v_text, 200), v_agent_id, now() + make_interval(mins => COALESCE(v_sla_minutes, 480)), v_lang, v_industry, v_c->>'safety_flag')
  RETURNING case_id, case_number INTO v_case_id, v_case_number;

  INSERT INTO public.conversations (case_id, channel) VALUES (v_case_id, 'web_chat') RETURNING conversation_id INTO v_conv_id;
  INSERT INTO public.messages (conversation_id, sender_type, sender_id, content)
  VALUES (v_conv_id, 'customer', p_user, v_text) RETURNING message_id INTO v_msg_id;

  INSERT INTO public.classifications (case_id, agent_id, intent, sentiment, urgency, risk, language, confidence)
  VALUES (v_case_id, '00000000-0000-0000-0000-000000000202', v_intent, v_sentiment, v_urgency, v_risk, v_lang, v_conf);
  INSERT INTO public.audit_logs (actor, actor_type, action, entity_type, entity_id, case_id, result, risk_level, details)
  VALUES ('Intent Classifier', 'ai_agent', 'classified_intent', 'cases', v_case_id, v_case_id, 'success', v_risk,
          jsonb_build_object('intent', v_intent, 'language', v_lang, 'confidence', v_conf, 'routed_to', v_agent_name, 'industry', v_industry));

  -- 2. decide: answer, or pass to a person (escalation rules + hard stops)
  v_esc := private.pick_escalation(v_c);
  v_esc_id := (v_esc->>'rule_id')::uuid;
  v_esc_name := v_esc->>'name';

  IF v_esc_id IS NOT NULL THEN
    v_status := 'escalated';
    UPDATE public.cases SET status = 'escalated', assigned_agent_id = NULL WHERE case_id = v_case_id;
    INSERT INTO public.escalations (case_id, reason, escalated_from, escalated_to, rule_id)
    VALUES (v_case_id, v_esc_name, COALESCE(v_agent_name, 'Orchestrator'), 'human_support_queue', v_esc_id);

    v_lang_name := CASE v_lang WHEN 'ne' THEN 'Nepali' WHEN 'hi' THEN 'Hindi' WHEN 'zh' THEN 'Chinese' WHEN 'ja' THEN 'Japanese'
                     WHEN 'ko' THEN 'Korean' WHEN 'ar' THEN 'Arabic' WHEN 'th' THEN 'Thai' WHEN 'vi' THEN 'Vietnamese'
                     WHEN 'es' THEN 'Spanish' END;
    IF v_injection THEN
      INSERT INTO public.security_events (event_type, case_id, message_id, severity, description, action_taken)
      VALUES ('prompt_injection', v_case_id, v_msg_id, 'high', left(v_text, 300), 'Blocked; case sent to human review');
      v_reply := 'For your security this request has been passed to our support team. A person will reply shortly.';
    ELSIF v_flag = 'product_safety' THEN
      v_reply := 'Thank you for telling us, and I''m sorry this happened. Please stop using the product now and keep it away from children and pets. I have passed this to our Product Safety team as urgent, and a person will contact you soon. If anyone is hurt, call 000. If something was swallowed or you suspect poisoning, call the Poisons Information Centre on 13 11 26.';
    ELSIF v_flag = 'wellbeing' THEN
      v_reply := 'I''m sorry you are going through this, and thank you for telling us. I have passed your message to the Student Wellbeing team as urgent, and a person will contact you soon. If you are in immediate danger, call 000. You can talk to Lifeline any time on 13 11 14.';
    ELSIF v_flag = 'visa' THEN
      v_reply := 'I can only share general visa information, not advice about your own visa. I have passed your question to our International Student Advisers, who will reply here. The official rules are on the Department of Home Affairs website (homeaffairs.gov.au).';
    ELSIF v_lang <> 'en' THEN
      v_reply := 'Thank you for your message' || CASE WHEN v_lang_name IS NOT NULL THEN ' in ' || v_lang_name ELSE '' END
              || '. I have passed it to a member of our team, who will reply as soon as possible.';
    ELSIF v_uni AND v_flag IS NOT NULL THEN
      v_reply := 'This needs a decision from a staff member, so I have passed it to the ' || v_dept || ' team. They will reply here shortly.';
    ELSIF v_sensitive THEN
      v_reply := 'This request needs approval from a staff member, so I have passed it to our support team. Estimated wait: a few minutes.';
      INSERT INTO public.audit_logs (actor, actor_type, action, entity_type, entity_id, case_id, result, risk_level)
      VALUES ('Policy Engine', 'system', 'restricted_action_blocked', 'cases', v_case_id, v_case_id, 'blocked', 'high');
    ELSIF v_esc_name = 'Customer Asks Human' THEN
      v_reply := 'Of course. I have passed your request to ' || CASE WHEN v_uni THEN 'the ' || v_dept || ' team' ELSE 'a member of our support team' END
              || ', who will reply here shortly.';
    ELSIF v_doc_id IS NULL THEN
      v_reply := 'I could not find an approved answer for that, so I have passed it to '
              || CASE WHEN v_uni THEN 'the ' || v_dept || ' team' ELSE 'a member of our support team' END || '. They will reply here shortly.';
    ELSE
      v_reply := 'I have passed your request to ' || CASE WHEN v_uni THEN 'the ' || v_dept || ' team' ELSE 'a member of our support team' END
              || ', who will reply shortly.';
    END IF;
    IF v_flag IS NOT NULL THEN
      INSERT INTO public.audit_logs (actor, actor_type, action, entity_type, entity_id, case_id, result, risk_level, details)
      VALUES ('Policy Engine', 'system', 'restricted_action_blocked', 'cases', v_case_id, v_case_id, 'blocked', 'high',
              jsonb_build_object('reason', v_flag, 'department', v_dept));
    END IF;

    INSERT INTO public.messages (conversation_id, sender_type, sender_id, content, message_type)
    VALUES (v_conv_id, 'system', NULL, v_reply, 'escalation_notice');
    INSERT INTO public.audit_logs (actor, actor_type, action, entity_type, entity_id, case_id, result, risk_level, details)
    VALUES ('Orchestrator', 'ai_agent', 'case_escalated', 'cases', v_case_id, v_case_id, 'success', v_risk,
            jsonb_build_object('rule', v_esc_name, 'department', v_dept));
    INSERT INTO public.notifications (user_id, type, title, case_id)
    SELECT u.user_id, 'new_escalation', v_case_number || ': ' || v_esc_name, v_case_id
    FROM public.users u WHERE u.role IN ('support_agent','team_leader') AND u.status = 'active';
  ELSE
    -- ---------- reply from the approved article found above ----------
    v_reply := COALESCE(v_doc_content, 'I could not find approved information for this, so I have passed it to our support team.');
    INSERT INTO public.messages (conversation_id, sender_type, sender_id, content)
    VALUES (v_conv_id, 'ai_agent', v_agent_id, v_reply) RETURNING message_id INTO v_reply_id;
    UPDATE public.cases SET first_response_at = now() WHERE case_id = v_case_id;
    IF v_doc_id IS NOT NULL THEN
      INSERT INTO public.message_citations (message_id, document_id, section) VALUES (v_reply_id, v_doc_id, v_doc_title);
      INSERT INTO public.knowledge_retrievals (document_id, case_id, agent_id, relevance)
      VALUES (v_doc_id, v_case_id, v_agent_id, v_conf);
    END IF;
    INSERT INTO public.audit_logs (actor, actor_type, action, entity_type, entity_id, case_id, result, risk_level)
    VALUES (COALESCE(v_agent_name, 'Orchestrator'), 'ai_agent', 'replied_from_knowledge', 'cases', v_case_id, v_case_id, 'success', 'low');
  END IF;
  RETURN jsonb_build_object(
    'case_id', v_case_id, 'case_number', v_case_number, 'status', v_status,
    'intent', v_intent, 'sentiment', v_sentiment, 'urgency', v_urgency, 'risk', v_risk, 'language', v_lang,
    'confidence', v_conf, 'routed_to', COALESCE(v_agent_name, 'Human Queue'), 'department', v_dept,
    'escalation_rule', v_esc_name, 'reply', v_reply,
    'source', CASE WHEN v_doc_id IS NOT NULL AND v_status = 'ai_handling' THEN v_doc_title || ' ' || v_doc_version END);
END $$;
REVOKE ALL ON FUNCTION private.handle_enquiry(uuid, uuid, text) FROM public, anon, authenticated;


-- ---------- safety reply in follow-ups (from 027) ----------
CREATE OR REPLACE FUNCTION public.customer_reply(p_case_id uuid, p_message text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_cust   uuid := private.require_customer();
  v_user   uuid := private.my_user_id();
  v_text   text := trim(COALESCE(p_message, ''));
  v_case   record;
  v_agent  uuid;
  v_conv   uuid;
  v_c      jsonb;
  v_esc    jsonb;
  v_reply  uuid;
  v_who    text;
BEGIN
  SELECT case_id, case_number, status, industry INTO v_case FROM public.cases WHERE case_id = p_case_id AND customer_id = v_cust FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conversation not found' USING ERRCODE = '22023'; END IF;
  IF v_case.status = 'closed' THEN RAISE EXCEPTION 'This conversation is closed. Please start a new one.' USING ERRCODE = '22023'; END IF;
  IF char_length(v_text) < 2 OR char_length(v_text) > 2000 THEN
    RAISE EXCEPTION 'Please write between 2 and 2000 characters' USING ERRCODE = '22023';
  END IF;
  v_conv := private.case_conversation(p_case_id);
  v_who := CASE WHEN v_case.industry = 'university' THEN 'Student' ELSE 'Customer' END;
  INSERT INTO public.messages (conversation_id, sender_type, sender_id, content) VALUES (v_conv, 'customer', v_user, v_text);
  INSERT INTO public.audit_logs (user_id, actor, actor_type, action, entity_type, entity_id, case_id, result, risk_level)
  VALUES (v_user, v_who, 'human', 'customer_replied', 'cases', p_case_id, p_case_id, 'success', 'low');

  -- 1. a staff member is on the case: it goes to them
  SELECT user_id INTO v_agent FROM public.case_assignments WHERE case_id = p_case_id AND status = 'active' ORDER BY assigned_at DESC LIMIT 1;
  IF v_agent IS NOT NULL THEN
    UPDATE public.cases SET status = 'human_handling', updated_at = now() WHERE case_id = p_case_id;
    INSERT INTO public.notifications (user_id, type, title, case_id, link)
    VALUES (v_agent, 'customer_reply', left(v_case.case_number || ': customer replied', 120), p_case_id, '/cases/' || p_case_id);
    RETURN jsonb_build_object('answered', false, 'to', 'person');
  END IF;

  -- 2. the AI checks it like a new question
  v_c := private.classify_enquiry(v_text, v_case.industry);
  v_esc := private.pick_escalation(v_c);
  IF v_esc IS NULL AND v_c->>'doc_id' IS NOT NULL THEN
    INSERT INTO public.messages (conversation_id, sender_type, sender_id, content)
    VALUES (v_conv, 'ai_agent', (v_c->>'agent_id')::uuid, v_c->>'doc_content') RETURNING message_id INTO v_reply;
    INSERT INTO public.message_citations (message_id, document_id, section) VALUES (v_reply, (v_c->>'doc_id')::uuid, v_c->>'doc_title');
    INSERT INTO public.knowledge_retrievals (document_id, case_id, agent_id, relevance)
    VALUES ((v_c->>'doc_id')::uuid, p_case_id, (v_c->>'agent_id')::uuid, (v_c->>'confidence')::numeric);
    -- still waiting for a person? it stays in their queue; otherwise the AI keeps the chat
    UPDATE public.cases SET status = CASE WHEN status = 'escalated' THEN 'escalated' ELSE 'ai_handling' END, updated_at = now()
    WHERE case_id = p_case_id;
    INSERT INTO public.audit_logs (actor, actor_type, action, entity_type, entity_id, case_id, result, risk_level, details)
    VALUES (COALESCE(v_c->>'agent_name', 'Orchestrator'), 'ai_agent', 'replied_from_knowledge', 'cases', p_case_id, p_case_id, 'success', 'low',
            jsonb_build_object('follow_up', true, 'article', v_c->>'doc_title', 'confidence', v_c->>'confidence'));
    RETURN jsonb_build_object('answered', true, 'source', v_c->>'doc_title');
  END IF;

  -- 3. no safe answer, or it needs a person: pass it on, and say so in the chat
  INSERT INTO public.messages (conversation_id, sender_type, sender_id, content, message_type)
  VALUES (v_conv, 'system', NULL,
    CASE WHEN v_c->>'flag' = 'product_safety' THEN
           'Thank you for telling us, and I''m sorry this happened. Please stop using the product now and keep it away from children and pets. I have passed this to our Product Safety team as urgent, and a person will contact you soon. If anyone is hurt, call 000. If something was swallowed or you suspect poisoning, call the Poisons Information Centre on 13 11 26.'
         WHEN v_c->>'flag' = 'wellbeing' THEN
           'I''m sorry you are going through this, and thank you for telling us. I have passed your message to the Student Wellbeing team as urgent, and a person will contact you soon. If you are in immediate danger, call 000. You can talk to Lifeline any time on 13 11 14.'
         WHEN v_c->>'flag' = 'visa' THEN
           'I can only share general visa information, not advice about your own visa. I have passed your question to our International Student Advisers, who will reply here.'
         WHEN (v_c->>'sensitive')::boolean THEN
           'This needs approval from a staff member, so I have passed it to our team. A person will reply here.'
         ELSE 'I have passed this to ' || CASE WHEN v_case.industry = 'university' THEN 'the ' || COALESCE(v_c->>'department', 'Student Services') || ' team' ELSE 'our support team' END
              || ', and a person will reply here.' END,
    'escalation_notice');
  UPDATE public.cases SET status = 'escalated', updated_at = now(),
         safety_flag = COALESCE(safety_flag, v_c->>'safety_flag'),
         priority = CASE WHEN v_c->>'flag' IN ('wellbeing', 'product_safety') THEN 'urgent' ELSE priority END
  WHERE case_id = p_case_id;
  -- 030: record the hand-over, so the duty-of-care report counts follow-ups that went to a person
  IF NOT EXISTS (SELECT 1 FROM public.escalations WHERE case_id = p_case_id) THEN
    INSERT INTO public.escalations (case_id, reason, escalated_from, escalated_to, rule_id)
    VALUES (p_case_id, COALESCE(v_esc->>'name', 'No approved answer'), COALESCE(v_c->>'agent_name', 'Orchestrator'), 'human_support_queue',
            (v_esc->>'rule_id')::uuid);
  END IF;
  INSERT INTO public.notifications (user_id, type, title, case_id, link)
  SELECT u.user_id, 'customer_reply', left(v_case.case_number || ': customer replied', 120), p_case_id, '/cases/' || p_case_id
  FROM public.users u WHERE u.role IN ('support_agent', 'team_leader') AND u.status = 'active';
  INSERT INTO public.audit_logs (actor, actor_type, action, entity_type, entity_id, case_id, result, risk_level, details)
  VALUES ('Orchestrator', 'ai_agent', 'case_escalated', 'cases', p_case_id, p_case_id, 'success', COALESCE(v_c->>'risk', 'low'),
          jsonb_build_object('follow_up', true, 'rule', COALESCE(v_esc->>'name', 'No approved answer')));
  RETURN jsonb_build_object('answered', false, 'to', 'team');
END $$;
REVOKE EXECUTE ON FUNCTION public.customer_reply(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.customer_reply(uuid, text) TO authenticated;


-- ---------- the rule simulator counts product safety as a hard stop (from 019) ----------
CREATE OR REPLACE FUNCTION public.simulate_rules(p_days int DEFAULT 30, p_threshold numeric DEFAULT NULL,
  p_angry boolean DEFAULT NULL, p_high_risk boolean DEFAULT NULL, p_paused uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_ind     text := public.current_industry();
  v_days    int  := CASE WHEN p_days IN (7, 30, 90) THEN p_days ELSE 30 END;
  r         record;
  v_q       text;
  v_now     jsonb;
  v_new     jsonb;
  v_cnow    jsonb;
  v_cnew    jsonb;
  v_total   int := 0; v_now_ai int := 0; v_new_ai int := 0; v_hard int := 0;
  v_changed jsonb := '[]';
  v_reasons jsonb := '{}';
BEGIN
  IF NOT (private.has_permission('configure_ai') OR private.has_permission('view_analytics')) THEN
    RAISE EXCEPTION 'You do not have permission to run the simulator.' USING ERRCODE = '42501';
  END IF;
  IF p_threshold IS NOT NULL AND (p_threshold < 0.3 OR p_threshold > 0.95) THEN
    RAISE EXCEPTION 'Confidence must be between 0.30 and 0.95.' USING ERRCODE = '22023';
  END IF;

  FOR r IN SELECT case_id, case_number FROM public.cases
           WHERE industry = v_ind AND created_at >= now() - make_interval(days => v_days)
           ORDER BY created_at DESC LIMIT 500 LOOP
    v_q := private.first_question(r.case_id);
    CONTINUE WHEN length(v_q) < 5;
    v_total := v_total + 1;
    v_cnow := private.classify_enquiry(v_q, v_ind);
    v_now  := private.pick_escalation(v_cnow);
    v_cnew := CASE WHEN p_paused IS NULL THEN v_cnow ELSE private.classify_enquiry(v_q, v_ind, p_paused) END;
    v_new  := private.pick_escalation(v_cnew, p_threshold, p_angry, p_high_risk);
    IF v_now IS NULL THEN v_now_ai := v_now_ai + 1; END IF;
    IF v_new IS NULL THEN v_new_ai := v_new_ai + 1;
    ELSE v_reasons := jsonb_set(v_reasons, ARRAY[v_new->>'name'], to_jsonb(COALESCE((v_reasons->>(v_new->>'name'))::int, 0) + 1));
    END IF;
    IF v_cnew->>'flag' IN ('wellbeing', 'visa', 'product_safety') THEN v_hard := v_hard + 1; END IF;
    IF (v_now IS NULL) <> (v_new IS NULL) OR v_now->>'name' IS DISTINCT FROM v_new->>'name' THEN
      v_changed := v_changed || jsonb_build_object('case_number', r.case_number, 'question', left(v_q, 140),
        'before', COALESCE(v_now->>'name', 'AI answers'), 'after', COALESCE(v_new->>'name', 'AI answers'),
        'to_person', v_new IS NOT NULL);
    END IF;
  END LOOP;

  RETURN jsonb_build_object('days', v_days, 'total', v_total,
    'now', jsonb_build_object('ai', v_now_ai, 'person', v_total - v_now_ai),
    'proposed', jsonb_build_object('ai', v_new_ai, 'person', v_total - v_new_ai),
    'hard_stops', v_hard, 'reasons', v_reasons,
    'changed', (SELECT COALESCE(jsonb_agg(x), '[]') FROM (SELECT x FROM jsonb_array_elements(v_changed) x LIMIT 40) s));
END $$;
REVOKE ALL ON FUNCTION public.simulate_rules(int, numeric, boolean, boolean, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.simulate_rules(int, numeric, boolean, boolean, uuid) TO authenticated;


-- ---------- report: the urgent safety numbers include product safety (from 019) ----------
CREATE OR REPLACE FUNCTION public.duty_of_care_report(p_days int DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_ind  text := public.current_industry();
  v_days int  := CASE WHEN p_days IN (7, 30, 90) THEN p_days ELSE 30 END;
  v_from timestamptz := now() - make_interval(days => v_days);
BEGIN
  IF NOT private.has_permission('view_analytics') THEN
    RAISE EXCEPTION 'You do not have permission to view this report.' USING ERRCODE = '42501';
  END IF;
  RETURN (
    WITH k AS (
      SELECT c.case_id, c.case_number, c.safety_flag, c.priority, c.status, c.language, c.created_at, c.risk,
             EXISTS (SELECT 1 FROM public.escalations e WHERE e.case_id = c.case_id) AS to_person,
             (SELECT min(e.created_at) FROM public.escalations e WHERE e.case_id = c.case_id) AS escalated_at,
             -- first time a person picked it up: took the case or replied
             (SELECT min(t) FROM (
                SELECT min(a.assigned_at) AS t FROM public.case_assignments a WHERE a.case_id = c.case_id
                UNION ALL
                SELECT min(m.sent_at) FROM public.messages m JOIN public.conversations v ON v.conversation_id = m.conversation_id
                WHERE v.case_id = c.case_id AND m.sender_type = 'human_agent') s) AS picked_at,
             (SELECT p.first_response_minutes FROM public.sla_policies p WHERE p.priority = c.priority) AS target_min
      FROM public.cases c WHERE c.industry = v_ind AND c.created_at >= v_from
    ), w AS (
      SELECT *, round(extract(epoch FROM picked_at - escalated_at) / 60)::int AS pickup_min FROM k
    )
    SELECT jsonb_build_object(
      'days', v_days, 'industry', v_ind, 'generated_at', now(),
      'cases', count(*),
      'ai_answered', count(*) FILTER (WHERE NOT to_person),
      'to_person', count(*) FILTER (WHERE to_person),
      'sensitive', count(*) FILTER (WHERE safety_flag IS NOT NULL),
      'sensitive_ai_only', count(*) FILTER (WHERE safety_flag IS NOT NULL AND NOT to_person),
      'by_flag', COALESCE((SELECT jsonb_object_agg(f, n) FROM (SELECT safety_flag AS f, count(*) AS n FROM w
                   WHERE safety_flag IS NOT NULL GROUP BY 1) x), '{}'),
      'picked_up', count(*) FILTER (WHERE to_person AND picked_at IS NOT NULL),
      'waiting_now', count(*) FILTER (WHERE to_person AND picked_at IS NULL AND status NOT IN ('resolved','closed')),
      'median_pickup_min', percentile_cont(0.5) WITHIN GROUP (ORDER BY pickup_min) FILTER (WHERE to_person AND pickup_min IS NOT NULL),
      'within_target', count(*) FILTER (WHERE to_person AND pickup_min IS NOT NULL AND pickup_min <= target_min),
      'wellbeing', jsonb_build_object(
          'cases', count(*) FILTER (WHERE safety_flag IN ('wellbeing', 'product_safety')),
          'urgent', count(*) FILTER (WHERE safety_flag IN ('wellbeing', 'product_safety') AND priority = 'urgent'),
          'median_pickup_min', percentile_cont(0.5) WITHIN GROUP (ORDER BY pickup_min) FILTER (WHERE safety_flag IN ('wellbeing', 'product_safety') AND pickup_min IS NOT NULL),
          'waiting_now', count(*) FILTER (WHERE safety_flag IN ('wellbeing', 'product_safety') AND picked_at IS NULL AND status NOT IN ('resolved','closed'))),
      'other_languages', count(*) FILTER (WHERE language <> 'en'),
      'other_languages_to_person', count(*) FILTER (WHERE language <> 'en' AND to_person),
      'injections_blocked', (SELECT count(*) FROM public.security_events s JOIN public.cases c ON c.case_id = s.case_id
                             WHERE c.industry = v_ind AND s.created_at >= v_from AND s.event_type = 'prompt_injection'),
      'audit_entries', (SELECT count(*) FROM public.audit_logs a JOIN public.cases c ON c.case_id = a.case_id
                        WHERE c.industry = v_ind AND a.created_at >= v_from),
      'list', COALESCE((SELECT jsonb_agg(jsonb_build_object('case_id', case_id, 'case_number', case_number, 'flag', safety_flag,
                 'priority', priority, 'status', status, 'created_at', created_at, 'to_person', to_person,
                 'pickup_min', pickup_min, 'target_min', target_min) ORDER BY created_at DESC)
                FROM w WHERE safety_flag IS NOT NULL), '[]'))
    FROM w);
END $$;
REVOKE ALL ON FUNCTION public.duty_of_care_report(int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.duty_of_care_report(int) TO authenticated;


-- ---------- a suggested staff reply for product safety (from 020) ----------
CREATE OR REPLACE FUNCTION public.suggest_reply(p_case uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_case   public.cases;
  v_q      text;
  c        jsonb;
  v_first  text;
  v_me     text;
  v_team   text;
  v_reason text;
  v_title  text;
  v_body   text;
  v_draft  text;
  v_topic  text;
BEGIN
  IF NOT private.has_permission('view_cases') THEN
    RAISE EXCEPTION 'You do not have permission to view cases.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_case FROM public.cases WHERE case_id = p_case;
  IF NOT FOUND THEN RETURN NULL; END IF;
  v_q := private.first_question(p_case);
  c := private.classify_enquiry(v_q, v_case.industry);
  v_first := split_part((SELECT u.name FROM public.customers k JOIN public.users u ON u.user_id = k.user_id
                         WHERE k.customer_id = v_case.customer_id), ' ', 1);
  v_me := split_part((SELECT name FROM public.users WHERE user_id = private.my_user_id()), ' ', 1);
  v_team := COALESCE(c->>'department', CASE WHEN v_case.industry = 'university' THEN 'Student Services' ELSE 'Support' END);
  v_reason := (SELECT reason FROM public.escalations WHERE case_id = p_case ORDER BY created_at DESC LIMIT 1);
  v_topic := CASE v_case.intent WHEN 'fees' THEN 'fees and finance' WHEN 'it_support' THEN 'IT support'
               WHEN 'academic' THEN 'study, exams or results' WHEN 'student_services' THEN 'student services'
               WHEN 'admissions' THEN 'admissions' WHEN 'order_status' THEN 'an order' WHEN 'return_request' THEN 'a return'
               WHEN 'billing_question' THEN 'billing' WHEN 'refund_request' THEN 'a refund' WHEN 'technical_issue' THEN 'a technical problem'
               WHEN 'account' THEN 'their account' ELSE 'something general' END;

  -- the best approved article: exact match first, otherwise the closest one
  v_title := c->>'doc_title'; v_body := c->>'doc_content';
  IF v_body IS NULL THEN
    SELECT d.title, d.content INTO v_title, v_body FROM public.knowledge_documents d, private.topic_query(v_q) q
    WHERE d.status = 'approved' AND d.industry = v_case.industry AND d.search @@ q
    ORDER BY ts_rank(d.search, q) DESC LIMIT 1;
  END IF;

  v_draft := 'Hi ' || COALESCE(nullif(v_first, ''), 'there') || ', thank you for your message. ' ||
    CASE v_case.safety_flag
      WHEN 'wellbeing' THEN 'I''m from the Student Wellbeing team and I''m glad you reached out. I would like to call you today to talk about how you are going and what support would help. What is a good time and number to reach you? If you ever feel unsafe, please call 000 straight away, or Lifeline on 13 11 14 at any time.'
      WHEN 'visa' THEN 'I''m an International Student Adviser. I can''t give advice on your own visa in writing, but I can book you a free, confidential appointment with an adviser to go through your situation. The general rules are on homeaffairs.gov.au. Would you like me to book a time this week?'
      WHEN 'academic' THEN 'I''ve looked at your request. Special consideration, academic integrity and grade review decisions are made by Academic Services using the evidence you provide. Please upload any supporting documents (for example a medical certificate) and I will make sure your request is assessed. I will keep you updated here.'
      WHEN 'finance' THEN 'I''ve looked at your account. Refund, hardship and debt requests are reviewed by Student Finance. I will check your enrolment dates and fees and reply here with the outcome. If you are under financial pressure right now, please let me know and I can refer you to hardship support.'
      WHEN 'product_safety' THEN 'I''m from the Product Safety team and I''m sorry this happened. Please keep the product aside and don''t use it again. Could you send a photo of the item and tell me if anyone was hurt? I will arrange a full refund or replacement and report it to the manufacturer.'
      WHEN 'refund' THEN 'I''ve checked your order and I''m reviewing the refund now. I will confirm the outcome here, and any approved refund takes 3 to 5 business days to appear on your statement.'
      ELSE COALESCE(v_body, 'I''ve looked into this for you and I will reply with the details shortly.')
    END ||
    E'\n\nPlease reply here if anything is unclear.\nKind regards,\n' || COALESCE(nullif(v_me, ''), 'The team') || ', ' || v_team;

  RETURN jsonb_build_object(
    'summary', COALESCE(nullif(v_first, ''), 'The person') || ' asked about ' || v_topic ||
               CASE WHEN v_case.sentiment IN ('angry', 'negative') THEN ' and sounds ' || CASE v_case.sentiment WHEN 'angry' THEN 'upset' ELSE 'unhappy' END ELSE '' END ||
               CASE WHEN v_case.language <> 'en' THEN ' (message not in English: reply in their language if you can)' ELSE '' END || '.' ||
               CASE WHEN v_reason = 'Answer did not help' THEN ' They said the AI''s answer' || COALESCE(' ("' || v_title || '")', '') ||
                    ' did not help, so add detail rather than sending the same answer.' ELSE '' END,
    'reason', COALESCE(v_reason, 'Not passed to a person'),
    'flag', v_case.safety_flag,
    'source', CASE WHEN v_case.safety_flag IS NULL OR v_case.safety_flag IN ('security','support','account_change','injection') THEN v_title END,
    'draft', v_draft);
END $$;
REVOKE ALL ON FUNCTION public.suggest_reply(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.suggest_reply(uuid) TO authenticated;
