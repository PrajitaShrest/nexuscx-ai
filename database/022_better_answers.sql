-- =====================================================================
-- NexusCX AI - Migration 022: better, more genuine answers
-- Run AFTER 021_separate_organisations.sql, once, in the Supabase SQL Editor.
--
-- 1. Every answer ends with WHO TO CONTACT: the role, email and hours of the
--    team responsible (departments table; an article can name its own
--    contact, e.g. Careers Adviser). Emails use the reserved .example
--    domain, so they can never reach a real person.
-- 2. More specific Northbridge articles. The combined "Careers and
--    accommodation" article is split, so a resume question gets a resume
--    answer. (Parking, prayer rooms and graduation are deliberately left
--    out, so the Knowledge gaps page still has something to show.)
-- 3. Everyday words ("bring", "room", "close"...) no longer count as a topic
--    match, so "Is there a prayer room?" is not answered with the library article.
--    Confidence now reflects how well the article matches the question:
--    title and keywords match = 96%, title or two keywords = 92%,
--    one keyword = 86%. Common questions are answered confidently.
-- =====================================================================
BEGIN;

-- ---------- 1. who is responsible for what ----------
CREATE TABLE IF NOT EXISTS public.departments (
  industry varchar(20) NOT NULL CHECK (industry IN ('ecommerce', 'university')),
  category varchar(50) NOT NULL,
  name     varchar(80) NOT NULL,
  role     varchar(80) NOT NULL,
  email    varchar(120) NOT NULL,
  hours    varchar(80),
  PRIMARY KEY (industry, category)
);
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Signed-in users read departments" ON public.departments;
CREATE POLICY "Signed-in users read departments" ON public.departments FOR SELECT TO authenticated USING (true);

INSERT INTO public.departments (industry, category, name, role, email, hours) VALUES
 ('university', 'admissions',       'Admissions',        'Admissions Officer',        'admissions@northbridge.example',     'Mon–Fri, 9am–5pm'),
 ('university', 'fees',             'Student Finance',   'Student Finance Officer',   'finance@northbridge.example',        'Mon–Fri, 9am–5pm'),
 ('university', 'it_support',       'IT Service Desk',   'IT Service Desk',           'servicedesk@northbridge.example',    'Mon–Fri, 8am–8pm'),
 ('university', 'academic',         'Academic Services', 'Academic Services Officer', 'academic@northbridge.example',       'Mon–Fri, 9am–5pm'),
 ('university', 'student_services', 'Student Services',  'Student Services Adviser',  'studentservices@northbridge.example','Mon–Fri, 9am–5pm'),
 ('university', 'general',          'Student Services',  'Student Services Adviser',  'studentservices@northbridge.example','Mon–Fri, 9am–5pm'),
 ('ecommerce',  'orders',           'Customer Care',     'Customer Care team',        'care@nexuscx-store.example',         'Mon–Sat, 8am–8pm'),
 ('ecommerce',  'billing',          'Billing',           'Billing team',              'billing@nexuscx-store.example',      'Mon–Fri, 9am–5pm'),
 ('ecommerce',  'technical',        'Technical Support', 'Technical Support team',    'tech@nexuscx-store.example',         'Every day, 8am–10pm'),
 ('ecommerce',  'account',          'Customer Care',     'Customer Care team',        'care@nexuscx-store.example',         'Mon–Sat, 8am–8pm'),
 ('ecommerce',  'general',          'Customer Care',     'Customer Care team',        'care@nexuscx-store.example',         'Mon–Sat, 8am–8pm')
ON CONFLICT (industry, category) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, email = EXCLUDED.email, hours = EXCLUDED.hours;

-- An article can name a more specific contact (e.g. the Careers Hub)
ALTER TABLE public.knowledge_documents ADD COLUMN IF NOT EXISTS contact_role varchar(80);
ALTER TABLE public.knowledge_documents ADD COLUMN IF NOT EXISTS contact_email varchar(120);

-- ---------- 2. more specific Northbridge articles ----------
-- The old combined article is archived (kept for history, no longer used)
UPDATE public.knowledge_documents SET status = 'archived'
WHERE title = 'Careers and accommodation' AND industry = 'university' AND status = 'approved';

UPDATE public.knowledge_documents SET contact_role = 'Wellbeing Centre', contact_email = 'wellbeing@northbridge.example'
WHERE industry = 'university' AND title = 'Wellbeing and counselling';
UPDATE public.knowledge_documents SET contact_role = 'International Student Adviser', contact_email = 'international@northbridge.example'
WHERE industry = 'university' AND title IN ('International student support', 'Student visa conditions (general information)');
UPDATE public.knowledge_documents SET contact_role = 'Student Centre (ID cards)', contact_email = 'idcards@northbridge.example'
WHERE industry = 'university' AND title = 'Student ID card';
UPDATE public.knowledge_documents SET contact_role = 'Scholarships Officer', contact_email = 'scholarships@northbridge.example'
WHERE industry = 'university' AND title = 'Scholarships';
UPDATE public.knowledge_documents SET contact_role = 'Exams Office', contact_email = 'exams@northbridge.example'
WHERE industry = 'university' AND title IN ('Exam timetable and venues', 'Results release and transcripts');

INSERT INTO public.knowledge_documents (title, category, keywords, content, status, version, owner, approved_by, approved_at, source, industry, contact_role, contact_email)
SELECT a.title, a.category, a.keywords, a.content, 'approved', 'v1.0', a.owner,
       (SELECT user_id FROM public.users WHERE role = 'knowledge_manager' ORDER BY name LIMIT 1), now(),
       'Northbridge University Student Hub', 'university', a.crole, a.cemail
FROM (VALUES
  -- Student services
  ('Resume help and career advice', 'student_services', 'Student Services',
   'resume cv cover letter career careers job interview internship employment advice',
   'The Careers Hub helps with resumes, cover letters, job interviews and internships. Book a free 30-minute resume check with a Careers Adviser in the Student Hub under Careers > Book an appointment, or drop in to Building B, Level 1, weekdays 10am–2pm. Bring a copy of your resume and the job ad if you have one.',
   'Careers Adviser', 'careers@northbridge.example'),
  ('Student accommodation', 'student_services', 'Student Services',
   'accommodation housing room rent live on campus residence where to live rental',
   'Northbridge has on-campus rooms in two residences, and the Accommodation Service lists checked private rentals near campus. Apply for a room in the Student Hub under Accommodation. Applications for Semester 1 open in October, and we can help with temporary housing when you first arrive.',
   'Accommodation Officer', 'accommodation@northbridge.example'),
  ('Lost or stolen student ID card', 'student_services', 'Student Services',
   'lost card stolen card replace card replacement id card damaged card',
   'Report a lost or stolen card in the Student Hub under My Card > Report lost. This stops the old card working straight away. Then order a replacement ($25) in the same place. It is ready to collect from the Student Centre (Building A, ground floor) in 2 business days; bring photo ID.',
   'Student Centre (ID cards)', 'idcards@northbridge.example'),
  ('Library opening hours and study rooms', 'student_services', 'Student Services',
   'library opening hours open close study room book a room quiet study borrow books',
   'The Library is open 8am–10pm on weekdays and 10am–6pm on weekends during semester. Book a group study room for up to 3 hours a day in the Student Hub under Library > Rooms. Quiet study is on Level 3. Hours change in the semester break; check the Library page.',
   'Library Help Desk', 'library@northbridge.example'),
  ('Disability support and access plans', 'student_services', 'Student Services',
   'disability access plan adjustments extra time exams accessibility support condition',
   'If a disability, health condition or caring role affects your study, Accessibility Services can create an Access Plan (for example extra time in exams or recorded lectures). Book an appointment in the Student Hub under Support > Accessibility. Your information is kept confidential.',
   'Accessibility Adviser', 'access@northbridge.example'),
  ('Orientation week', 'student_services', 'Student Services',
   'orientation o week new student welcome first week start induction campus tour',
   'Orientation runs in the week before teaching starts. You can join campus tours, meet your faculty, set up your student card and IT account, and find clubs. The full program is in the Student Hub under Orientation.',
   'Student Experience team', 'welcome@northbridge.example'),
  ('Clubs and societies', 'student_services', 'Student Services',
   'clubs societies join club sport social activities events student life',
   'There are more than 80 clubs and societies, from sport to culture to study groups. Browse and join them in the Student Hub under Clubs. Most clubs are free to join for students.',
   'Student Experience team', 'welcome@northbridge.example'),
  -- Admissions
  ('Checking your application status', 'admissions', 'Admissions',
   'application status check application where is my application outcome decision pending',
   'Sign in to the Applicant Portal and open My Applications to see your status: Received, In assessment, Offer made or Unsuccessful. Most applications are assessed within 10 business days. If we need more documents, the portal shows a task for you.',
   NULL, NULL),
  ('Documents you need to apply', 'admissions', 'Admissions',
   'documents upload transcript passport certificate english test proof apply what do i need',
   'Most applications need your academic transcripts and certificates, proof of identity (passport or driver licence) and, if English is not your first language, an English test result. Upload clear scans or photos in the Applicant Portal. Documents not in English need a certified translation.',
   NULL, NULL),
  -- Fees
  ('Paying fees with a HELP loan', 'fees', 'Student Finance',
   'help loan hecs fee help commonwealth supported defer fees government loan',
   'Eligible domestic students can defer their fees with a government HELP loan (HECS-HELP or FEE-HELP). Apply through the Student Hub under Fees > HELP loans before the census date. Your loan is repaid through the tax system once you earn above the repayment threshold. Check eligibility on studyassist.gov.au.',
   NULL, NULL),
  ('Understanding your Statement of Account', 'fees', 'Student Finance',
   'statement of account fees owing balance due invoice what do i owe charges',
   'Your Statement of Account in the Student Hub lists your units, the fee for each, any payments and your balance. It updates the day after you change your enrolment. If something looks wrong, check your enrolled units first, then contact Student Finance.',
   NULL, NULL),
  -- IT support
  ('Printing on campus', 'it_support', 'IT Service Desk',
   'print printing printer print credit scan photocopy',
   'Print from any campus computer or your laptop to "Northbridge-Print", then release the job at any printer with your student ID card. Add print credit in the Student Hub under IT > Print credit. Black and white is 10 cents a page.',
   NULL, NULL),
  ('Free software for students', 'it_support', 'IT Service Desk',
   'software free download microsoft office spss matlab adobe licence install',
   'Students get Microsoft 365 for free, and some units provide other software (for example SPSS or MATLAB). See the Software page in the Student Hub for downloads and licence steps for each program.',
   NULL, NULL),
  -- Academic
  ('Withdrawing from a unit', 'academic', 'Academic Services',
   'withdraw drop unit leave unit withdrawal without penalty fail',
   'Withdraw from a unit in the Student Hub under My Study Plan. Before the census date there is no fee and no grade. After the census date you pay for the unit and, after week 8, it shows as a fail unless you apply for special consideration.',
   NULL, NULL),
  ('Changing your course or major', 'academic', 'Academic Services',
   'change course change major transfer degree switch program',
   'To change your major within the same degree, update your study plan in the Student Hub. To move to a different degree, apply for an internal course transfer in the Applicant Portal. Credit for units you have passed is assessed automatically.',
   NULL, NULL),
  ('Ordering an official transcript', 'academic', 'Academic Services',
   'official transcript order transcript academic record certified copy completion letter',
   'Download an unofficial transcript free in the Student Hub at any time. Order an official transcript (digital or printed, $20) under My Results > Order transcript. Digital transcripts arrive by email within 2 business days.',
   'Exams Office', 'exams@northbridge.example'),
  ('Exam rules and what to bring', 'academic', 'Academic Services',
   'exam rules what to bring calculator phone late arrival exam room id card',
   'Arrive 15 minutes early and bring your student ID card. You may bring pens, a clear water bottle and any items your unit allows (for example an approved calculator). Phones must be switched off and left in your bag. You cannot enter more than 30 minutes after the start.',
   'Exams Office', 'exams@northbridge.example')
) AS a(title, category, owner, keywords, content, crole, cemail)
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_documents d WHERE d.title = a.title);

-- ---------- 3. confidence that matches the answer (and the contact line) ----------
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
    IF v_low ~ '(suicid|self.?harm|kill myself|end my life|hurt myself|can.?t cope|cannot cope|overwhelmed|so stressed|really stressed|anxious|anxiety|depress|mental health|panic attack|not safe)' THEN
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
    -- E-commerce (unchanged from migration 009)
    IF v_low ~ '(refund|charged twice|double charge|money back|chargeback)' THEN
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

  IF v_low ~ '(urgent|asap|immediately|right now|emergency)' OR v_flag = 'wellbeing' THEN v_urgency := 'critical';
  ELSIF v_sentiment IN ('angry','negative') THEN v_urgency := 'high';
  ELSIF v_intent = 'unknown' THEN v_urgency := 'low';
  END IF;

  IF v_uni THEN
    v_sensitive := v_flag IS NOT NULL OR v_low ~ '(legal|lawyer|delete my account)';
  ELSE
    v_sensitive := v_intent = 'refund_request'
                OR v_low ~ '(change my (bank|card|account)|delete my account|close my account|legal|lawyer)';
  END IF;
  v_risk := CASE WHEN v_injection THEN 'critical' WHEN v_sensitive THEN 'high'
                 WHEN v_sentiment = 'angry' THEN 'medium' ELSE 'low' END;
  v_priority := CASE WHEN v_flag = 'wellbeing' THEN 'urgent'
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
  IF v_flag = 'wellbeing' THEN v_dept := 'Student Wellbeing';
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
COMMIT;
