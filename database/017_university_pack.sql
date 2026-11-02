-- =====================================================================
-- NexusCX AI - Migration 017: Industry Packs + the University pack
-- Run AFTER 016_rate_limits_and_photos.sql, once, in the Supabase SQL Editor.
--
-- NexusCX becomes one platform with "industry packs". Each pack has its
-- own AI agents, knowledge base, routing and cases. An administrator picks
-- the active pack in Settings (setting "industry"):
--   ecommerce  - the online store we built in Weeks 5-8 (default)
--   university - Northbridge University (a made-up university for the demo)
--
-- University flow (matches the team's flowchart):
--   student message -> Orchestrator -> classify intent, language, sentiment,
--   urgency, risk -> department -> department agent + department knowledge
--   base -> answer with source -> policy / confidence / risk check
--   -> pass: answer the student | fail: ticket to a person -> staff resolve
--   -> feedback -> analytics.
-- Departments: Admissions, Finance, IT Support, Academic (incl. exams and
-- results), Student Services (incl. ID cards, international students, visas).
--
-- 1. industry column on agents, routing rules, knowledge and cases
-- 2. "industry" setting + public.current_industry()
-- 3. Each pack only sees its own agents, rules, articles and cases (RLS)
-- 4. Five university agents, their routing rules and 25 approved articles
-- 5. submit_enquiry(): university classifier, language detection, wellbeing
--    and visa safety rules, department-aware replies
-- 6. Knowledge editor accepts university categories
-- 7. Analytics and Team Operations count only the active pack
-- 8. Sample university cases so the dashboards are not empty
-- =====================================================================
BEGIN;

-- ---------- 1 + 2. the active industry ----------
INSERT INTO public.platform_settings (setting_key, value, category, description)
VALUES ('industry', '"ecommerce"', 'general', 'Active industry pack (ecommerce or university)')
ON CONFLICT (setting_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.current_industry() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((SELECT value #>> '{}' FROM public.platform_settings WHERE setting_key = 'industry'), 'ecommerce')
$$;
GRANT EXECUTE ON FUNCTION public.current_industry() TO anon, authenticated;

-- Only known packs can be chosen (update_setting shows this message)
CREATE OR REPLACE FUNCTION private.check_industry_setting() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.setting_key = 'industry' AND (NEW.value #>> '{}') NOT IN ('ecommerce', 'university') THEN
    RAISE EXCEPTION 'Choose E-commerce or University.' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_check_industry ON public.platform_settings;
CREATE TRIGGER trg_check_industry BEFORE INSERT OR UPDATE ON public.platform_settings
FOR EACH ROW EXECUTE FUNCTION private.check_industry_setting();

-- 'all' = shared by every pack (Orchestrator, Classifier, Safety Checker, ...)
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS industry varchar(20) NOT NULL DEFAULT 'all'
  CHECK (industry IN ('all', 'ecommerce', 'university'));
UPDATE public.ai_agents SET industry = 'ecommerce' WHERE type = 'specialist' AND industry = 'all';

ALTER TABLE public.routing_rules ADD COLUMN IF NOT EXISTS industry varchar(20) NOT NULL DEFAULT 'all'
  CHECK (industry IN ('all', 'ecommerce', 'university'));
UPDATE public.routing_rules SET industry = 'ecommerce' WHERE action = 'route_to_agent' AND industry = 'all';

-- New articles and new cases belong to the pack that is active when they are made
ALTER TABLE public.knowledge_documents ADD COLUMN IF NOT EXISTS industry varchar(20) NOT NULL DEFAULT 'ecommerce'
  CHECK (industry IN ('ecommerce', 'university'));
ALTER TABLE public.knowledge_documents ALTER COLUMN industry SET DEFAULT public.current_industry();

ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS industry varchar(20) NOT NULL DEFAULT 'ecommerce'
  CHECK (industry IN ('ecommerce', 'university'));
ALTER TABLE public.cases ALTER COLUMN industry SET DEFAULT public.current_industry();
CREATE INDEX IF NOT EXISTS idx_cases_industry ON public.cases(industry);

-- ---------- 3. each pack sees only its own data ----------
-- RESTRICTIVE policies are added ON TOP of the existing ones: a row must pass
-- the old rules (role, ownership) AND belong to the active pack.
DROP POLICY IF EXISTS "Active industry only" ON public.cases;
CREATE POLICY "Active industry only" ON public.cases AS RESTRICTIVE FOR SELECT TO authenticated
  USING (industry = (SELECT public.current_industry()));
DROP POLICY IF EXISTS "Active industry only" ON public.knowledge_documents;
CREATE POLICY "Active industry only" ON public.knowledge_documents AS RESTRICTIVE FOR SELECT TO authenticated
  USING (industry = (SELECT public.current_industry()));
DROP POLICY IF EXISTS "Active industry only" ON public.ai_agents;
CREATE POLICY "Active industry only" ON public.ai_agents AS RESTRICTIVE FOR SELECT TO authenticated
  USING (industry IN ('all', (SELECT public.current_industry())));
DROP POLICY IF EXISTS "Active industry only" ON public.routing_rules;
CREATE POLICY "Active industry only" ON public.routing_rules AS RESTRICTIVE FOR SELECT TO authenticated
  USING (industry IN ('all', (SELECT public.current_industry())));
-- Tables that hang off a case follow the case
DROP POLICY IF EXISTS "Active industry only" ON public.conversations;
CREATE POLICY "Active industry only" ON public.conversations AS RESTRICTIVE FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cases c WHERE c.case_id = conversations.case_id AND c.industry = (SELECT public.current_industry())));
DROP POLICY IF EXISTS "Active industry only" ON public.escalations;
CREATE POLICY "Active industry only" ON public.escalations AS RESTRICTIVE FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cases c WHERE c.case_id = escalations.case_id AND c.industry = (SELECT public.current_industry())));
DROP POLICY IF EXISTS "Active industry only" ON public.feedback;
CREATE POLICY "Active industry only" ON public.feedback AS RESTRICTIVE FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cases c WHERE c.case_id = feedback.case_id AND c.industry = (SELECT public.current_industry())));

-- ---------- 4a. university agents ----------
INSERT INTO public.ai_agents (agent_id, name, type, description, model_name, status, department, industry, confidence_threshold)
VALUES
 ('00000000-0000-0000-0000-000000000209', 'Admissions Agent', 'specialist',
  'Courses, entry requirements, applications, offers and intakes', 'llm-general', 'active', 'Admissions', 'university', 0.700),
 ('00000000-0000-0000-0000-000000000210', 'Finance Agent', 'specialist',
  'Tuition fees, due dates, payment plans, invoices and scholarships', 'llm-general', 'active', 'Student Finance', 'university', 0.700),
 ('00000000-0000-0000-0000-000000000211', 'IT Support Agent', 'specialist',
  'Passwords, Wi-Fi, Moodle, student email and MFA', 'llm-general', 'active', 'IT Service Desk', 'university', 0.700),
 ('00000000-0000-0000-0000-000000000212', 'Academic Agent', 'specialist',
  'Enrolment, timetables, census dates, extensions, exams, results and transcripts', 'llm-general', 'active', 'Academic Services', 'university', 0.700),
 ('00000000-0000-0000-0000-000000000213', 'Student Services Agent', 'specialist',
  'Student ID cards, international students, visa information, wellbeing, careers and accommodation', 'llm-general', 'active', 'Student Services', 'university', 0.700)
ON CONFLICT (agent_id) DO NOTHING;

-- ---------- 4b. university routing (department -> agent) ----------
INSERT INTO public.routing_rules (name, intent, agent_id, action, priority, condition, industry)
SELECT v.name, v.intent, v.agent_id::uuid, 'route_to_agent', v.priority, '{"max_risk": "medium", "min_confidence": 0.6}'::jsonb, 'university'
FROM (VALUES
  ('Admissions Department',       'admissions',       '00000000-0000-0000-0000-000000000209', 12),
  ('Finance Department',          'fees',             '00000000-0000-0000-0000-000000000210', 13),
  ('IT Support Department',       'it_support',       '00000000-0000-0000-0000-000000000211', 14),
  ('Academic Department',         'academic',         '00000000-0000-0000-0000-000000000212', 15),
  ('Student Services Department', 'student_services', '00000000-0000-0000-0000-000000000213', 16),
  ('General University Questions','general',          '00000000-0000-0000-0000-000000000213', 71)
) AS v(name, intent, agent_id, priority)
WHERE NOT EXISTS (SELECT 1 FROM public.routing_rules r WHERE r.name = v.name);

-- ---------- 4c. university knowledge bases (approved sample articles) ----------
INSERT INTO public.knowledge_documents (title, category, keywords, content, status, version, owner, approved_by, approved_at, source, industry)
SELECT a.title, a.category, a.keywords, a.content, 'approved', 'v1.0', a.owner,
       (SELECT user_id FROM public.users WHERE role = 'knowledge_manager' ORDER BY name LIMIT 1), now(),
       'Northbridge University Student Hub', 'university'
FROM (VALUES
  -- Admissions KB
  ('How to apply to Northbridge', 'admissions', 'Admissions',
   'apply application how to apply course undergraduate postgraduate portal',
   'Apply online through the Northbridge Applicant Portal. Choose your course and intake, upload your transcripts and ID, and submit. Most applications receive an outcome within 10 business days. You can track your application status in the portal at any time.'),
  ('Entry requirements', 'admissions', 'Admissions',
   'entry requirements atar prerequisite english ielts pte requirement eligible',
   'Each course page lists its entry requirements, prerequisites and English language requirements (for example IELTS or PTE scores). If you studied overseas, our Admissions team compares your qualification with Australian standards when you apply.'),
  ('Intakes and application deadlines', 'admissions', 'Admissions',
   'intake deadline semester 1 semester 2 trimester close start date when apply by',
   'Northbridge has two main intakes: Semester 1 (February) and Semester 2 (July). Domestic applications close 2 weeks before teaching starts. International applications close 8 weeks before, to allow time for a visa. Exact dates are shown on each course page.'),
  ('Accepting your offer', 'admissions', 'Admissions',
   'offer letter accept offer conditional unconditional defer offer',
   'Accept your offer in the Applicant Portal before the date in your offer letter. A conditional offer becomes unconditional once you meet the listed conditions. You can ask to defer your offer by up to one year from the same page.'),
  ('Credit for previous study', 'admissions', 'Admissions',
   'credit transfer recognition of prior learning rpl advanced standing previous study',
   'You can apply for credit (advanced standing) for previous study when you apply or after you accept your offer. Upload your transcripts and unit outlines. Credit decisions are made by an academic assessor, so a person will always review your request.'),
  -- Finance KB
  ('Tuition fees and due dates', 'fees', 'Student Finance',
   'fee fees tuition cost how much due date pay when invoice statement',
   'Your tuition fees are shown on your Statement of Account in the Student Hub. Fees for each study period are due by the census date. If fees are unpaid after the due date, a hold may be placed on your results and enrolment.'),
  ('How to pay your fees', 'fees', 'Student Finance',
   'pay fees payment bpay card bank transfer how to pay international payment',
   'You can pay by card or BPAY in the Student Hub, or by international bank transfer (details are on your Statement of Account). Always include your student ID as the payment reference so it is matched to your account.'),
  ('Payment plans', 'fees', 'Student Finance',
   'payment plan instalment split payments cannot pay on time pay later',
   'If you cannot pay your full fees by the due date, you can request a payment plan in the Student Hub before the census date. Plans split your fees into up to 3 instalments. Our Student Finance team will confirm the plan by email.'),
  ('Scholarships', 'fees', 'Student Finance',
   'scholarship bursary grant merit financial support apply scholarship',
   'Northbridge offers merit, equity and international scholarships. Search and apply on the Scholarships page. Most scholarships open 10 weeks before each intake. Successful students are contacted by email.'),
  ('Fee refunds and withdrawals', 'fees', 'Student Finance',
   'refund withdraw withdrawal drop unit before census money back fee refund',
   'If you withdraw from a unit before its census date, the fee for that unit is removed or refunded. After the census date fees are usually not refunded. Every refund request is reviewed by a member of the Student Finance team.'),
  -- IT Support KB
  ('Resetting your student password', 'it_support', 'IT Service Desk',
   'password reset forgot password locked out login sign in student account',
   'Reset your password at the Northbridge password page using your student ID and the mobile number on your record. After 5 wrong attempts your account locks for 15 minutes. Never share your password with anyone, including staff.'),
  ('Connecting to campus Wi-Fi', 'it_support', 'IT Service Desk',
   'wifi wi-fi wireless internet eduroam connect campus network',
   'Connect to the "Northbridge-Student" Wi-Fi network and sign in with your student ID and password. On a new device, forget the network first and reconnect. Wi-Fi is available in all buildings and the library.'),
  ('Moodle and online learning', 'it_support', 'IT Service Desk',
   'moodle lms online learning cannot see unit course page missing lectures recordings',
   'Your units appear in Moodle within 24 hours of enrolling. If a unit is missing, check your enrolment in the Student Hub first. Lecture recordings are posted in each unit''s Moodle page, usually within 48 hours.'),
  ('Student email and Microsoft 365', 'it_support', 'IT Service Desk',
   'email outlook microsoft 365 office student email teams install office',
   'Your student email is your studentID@student.northbridge.edu.au. Sign in at office.com with your student ID and password. Students can install Microsoft 365 apps on up to 5 devices for free while enrolled.'),
  ('Multi-factor authentication (MFA)', 'it_support', 'IT Service Desk',
   'mfa multi factor authentication authenticator app new phone code not working',
   'Northbridge uses the Microsoft Authenticator app for MFA. If you have a new phone, sign in on a computer and update your MFA method under Security Info. If you have lost access to both, the IT Service Desk can reset it after checking your identity.'),
  -- Academic KB
  ('Enrolling in units', 'academic', 'Academic Services',
   'enrol enrolment enroll units subjects add unit drop unit study plan',
   'Enrol in units through the Student Hub under My Study Plan. You can add units until the end of week 2 of the study period. Check your course structure first so you choose units that count towards your degree.'),
  ('Census dates', 'academic', 'Academic Services',
   'census date last day withdraw without penalty fees census',
   'The census date is the last day to withdraw from a unit without paying for it and without a fail grade. It is usually the end of week 4 of the study period. Census dates for your units are shown in the Student Hub.'),
  ('Class timetables', 'academic', 'Academic Services',
   'timetable class times tutorial lecture schedule allocate classes clash',
   'Your personal timetable is in the Student Hub once you enrol. Tutorial allocation opens 2 weeks before teaching starts. If two classes clash, choose another tutorial time or contact Academic Services.'),
  ('Assignment extensions and special consideration', 'academic', 'Academic Services',
   'extension assignment late special consideration sick medical certificate due date',
   'Short extensions (up to 5 days) can be requested from your unit coordinator before the due date. For longer extensions or exams affected by illness or hardship, apply for Special Consideration with supporting documents. Special Consideration is always decided by a staff member.'),
  ('Exam timetable and venues', 'academic', 'Academic Services',
   'exam timetable exam date venue room where is my exam final exam schedule',
   'The final exam timetable is published in the Student Hub 4 weeks before the exam period. It shows the date, time and venue of each exam. Bring your student ID card to every exam, as you will not be admitted without it.'),
  ('Results release and transcripts', 'academic', 'Academic Services',
   'results release grades marks when are results out transcript academic record',
   'Results are released in the Student Hub 2 weeks after the exam period ends. You can download an unofficial transcript at any time. Official transcripts can be ordered online. If you believe a mark is wrong, you can request a review of grade, which a staff member will assess.'),
  -- Student Services KB
  ('Student ID card', 'student_services', 'Student Services',
   'student id card student card new card lost card replacement card photo collect',
   'Upload a photo in the Student Hub to get your student ID card, then collect it from the Student Centre (Building A, ground floor) with photo ID. If your card is lost or stolen, report it in the Student Hub straight away; a replacement costs $25 and is ready in 2 business days.'),
  ('International student support', 'student_services', 'Student Services',
   'international student coe confirmation of enrolment oshc health cover arrival orientation',
   'International Student Advisers help with your Confirmation of Enrolment (CoE), Overseas Student Health Cover (OSHC), arrival and orientation. Keep your address and phone number up to date in the Student Hub, as this is a condition of your student visa.'),
  ('Student visa conditions (general information)', 'student_services', 'Student Services',
   'visa student visa conditions work hours work rights attendance course progress home affairs subclass 500',
   'Student visa holders must stay enrolled, make satisfactory course progress, keep health cover and follow the work limits set by the Australian Government. Work limits can change, so always check the current rules on the Department of Home Affairs website (homeaffairs.gov.au). We cannot give advice about your personal visa; for that, our International Student Advisers or a registered migration agent can help.'),
  ('Wellbeing and counselling', 'student_services', 'Student Services',
   'wellbeing counselling counsellor mental health stress anxiety support talk to someone',
   'Free and confidential counselling is available to all students. Book in the Student Hub or visit the Wellbeing Centre (Building C). If you are in immediate danger call 000. For 24/7 support call Lifeline on 13 11 14.'),
  ('Careers and accommodation', 'student_services', 'Student Services',
   'career careers job resume internship accommodation housing student housing',
   'The Careers Hub offers resume checks, mock interviews and internship listings. For a place to live, the Accommodation Service lists on-campus rooms and checked private rentals near campus.')
) AS a(title, category, owner, keywords, content)
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_documents d WHERE d.title = a.title);

-- ---------- 5a. language detection (by writing system and common words) ----------
-- Simple and explainable: no outside service. Returns a language code.
CREATE OR REPLACE FUNCTION private.detect_language(p_text text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE
    WHEN p_text ~ '[ऀ-ॿ]' THEN
      CASE WHEN p_text ~ '(छ|छन्|हुन्छ|गर्न|मेरो|कसरी|कहिले|पाउन)' THEN 'ne' ELSE 'hi' END
    WHEN p_text ~ '[一-鿿]' AND p_text !~ '[぀-ヿ]' THEN 'zh'
    WHEN p_text ~ '[぀-ヿ]' THEN 'ja'
    WHEN p_text ~ '[가-힯]' THEN 'ko'
    WHEN p_text ~ '[؀-ۿ]' THEN 'ar'
    WHEN p_text ~ '[฀-๿]' THEN 'th'
    WHEN p_text ~* '[ăơưđạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]' THEN 'vi'
    WHEN lower(p_text) ~ '\m(hola|gracias|por favor|quiero|necesito|tengo|dónde|cuándo|matrícula)\M' THEN 'es'
    ELSE 'en' END
$$;

-- ---------- 5b. the AI pipeline (one core, used by the chat and by seeding) ----------
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
    ELSIF v_low ~ '(id card|student card|\mcard\M|lost my card|international student|orientation|accommodation|housing|career|resume|internship|\mclub|disability|access plan|parking|counsel|complaint|wellbeing)' THEN
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
  v_words := array_to_string(ARRAY(SELECT DISTINCT w FROM regexp_split_to_table(v_low, '[^a-z0-9]+') w WHERE length(w) >= 2), ' or ');
  IF v_words <> '' AND v_lang = 'en' THEN
    v_query := websearch_to_tsquery('english', v_words);
    SELECT d.document_id, d.title, d.version, d.content INTO v_doc_id, v_doc_title, v_doc_version, v_doc_content
    FROM public.knowledge_documents d
    WHERE d.status = 'approved' AND d.industry = v_industry AND d.search @@ v_query
    ORDER BY ts_rank(d.search, v_query) + CASE WHEN d.category = v_cat THEN 0.3 ELSE 0 END DESC, d.updated_at DESC
    LIMIT 1;
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

  -- ---------- route (first matching active rule in this pack) ----------
  SELECT r.agent_id, a.name, a.department INTO v_agent_id, v_agent_name, v_dept
  FROM public.routing_rules r JOIN public.ai_agents a ON a.agent_id = r.agent_id
  WHERE r.status = 'active' AND r.action = 'route_to_agent' AND r.intent = v_intent AND a.status = 'active'
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

  -- ---------- create case, conversation, customer message ----------
  SELECT resolution_minutes INTO v_sla_minutes FROM public.sla_policies WHERE priority = v_priority;
  INSERT INTO public.cases (customer_id, status, priority, intent, sentiment, urgency, risk, confidence,
                            subject, assigned_agent_id, sla_due_at, language, industry)
  VALUES (p_customer, 'ai_handling', v_priority, v_intent, v_sentiment, v_urgency, v_risk, v_conf,
          left(v_text, 200), v_agent_id, now() + make_interval(mins => COALESCE(v_sla_minutes, 480)), v_lang, v_industry)
  RETURNING case_id, case_number INTO v_case_id, v_case_number;

  INSERT INTO public.conversations (case_id, channel) VALUES (v_case_id, 'web_chat') RETURNING conversation_id INTO v_conv_id;
  INSERT INTO public.messages (conversation_id, sender_type, sender_id, content)
  VALUES (v_conv_id, 'customer', p_user, v_text) RETURNING message_id INTO v_msg_id;

  INSERT INTO public.classifications (case_id, agent_id, intent, sentiment, urgency, risk, language, confidence)
  VALUES (v_case_id, '00000000-0000-0000-0000-000000000202', v_intent, v_sentiment, v_urgency, v_risk, v_lang, v_conf);
  INSERT INTO public.audit_logs (actor, actor_type, action, entity_type, entity_id, case_id, result, risk_level, details)
  VALUES ('Intent Classifier', 'ai_agent', 'classified_intent', 'cases', v_case_id, v_case_id, 'success', v_risk,
          jsonb_build_object('intent', v_intent, 'language', v_lang, 'confidence', v_conf, 'routed_to', v_agent_name, 'industry', v_industry));

  -- ---------- escalation rules: security rule first, then priority order; first match wins ----------
  FOR v_rule IN SELECT * FROM public.escalation_rules WHERE status = 'active'
                ORDER BY (condition_type = 'prompt_injection') DESC, priority LOOP
    IF (v_rule.condition_type = 'prompt_injection'        AND v_injection)
    OR (v_rule.condition_type = 'risk_equals'             AND v_risk = v_rule.threshold_value)
    OR (v_rule.condition_type = 'sensitive_action'        AND v_sensitive)
    OR (v_rule.condition_type = 'sentiment_equals'        AND v_sentiment = v_rule.threshold_value)
    OR (v_rule.condition_type = 'urgency_equals'          AND v_urgency = v_rule.threshold_value)
    OR (v_rule.condition_type = 'confidence_below'        AND v_conf < COALESCE(v_rule.threshold_value::numeric, v_threshold))
    OR (v_rule.condition_type = 'customer_requests_human' AND v_low ~ '(human|real person|speak to (an? )?(agent|someone))')
    OR (v_rule.condition_type = 'agent_cannot_answer'     AND (v_agent_id IS NULL OR v_doc_id IS NULL)) THEN
      v_esc_id := v_rule.rule_id;
      v_esc_name := v_rule.name;
      EXIT;
    END IF;
  END LOOP;
  -- Wellbeing and personal visa questions ALWAYS go to a person, even if a rule was switched off
  IF v_esc_id IS NULL AND v_flag IN ('wellbeing', 'visa') THEN
    SELECT rule_id, name INTO v_esc_id, v_esc_name FROM public.escalation_rules WHERE condition_type = 'sensitive_action';
    v_esc_name := COALESCE(v_esc_name, 'Sensitive Action');
  END IF;

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
    IF v_uni AND v_flag IS NOT NULL THEN
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

-- The chat calls this. Same checks as before; the work is done above.
CREATE OR REPLACE FUNCTION public.submit_enquiry(p_message text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_customer_id uuid := private.my_customer_id();
  v_text        text := trim(COALESCE(p_message, ''));
BEGIN
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Only signed-in customers can submit an enquiry' USING ERRCODE = '42501';
  END IF;
  IF char_length(v_text) < 5 THEN
    RAISE EXCEPTION 'Please describe your issue in at least 5 characters' USING ERRCODE = '22023';
  ELSIF char_length(v_text) > 2000 THEN
    RAISE EXCEPTION 'Please keep your message under 2000 characters' USING ERRCODE = '22023';
  END IF;
  RETURN private.handle_enquiry(v_customer_id, private.my_user_id(), v_text);
END $$;
REVOKE EXECUTE ON FUNCTION public.submit_enquiry(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.submit_enquiry(text) TO authenticated;

-- ---------- 6. knowledge editor: categories follow the active pack ----------
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
  IF p_category NOT IN (SELECT unnest(CASE WHEN public.current_industry() = 'university'
       THEN ARRAY['admissions','fees','it_support','academic','student_services','general']
       ELSE ARRAY['orders','billing','technical','account','general'] END)) THEN
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

-- ---------- 7. analytics and team operations count only the active pack ----------
CREATE OR REPLACE FUNCTION public.analytics_breakdowns(p_days int DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_days int := CASE WHEN p_days IN (7, 30, 90) THEN p_days ELSE 30 END;
  v_from timestamptz := date_trunc('day', now()) - (v_days - 1) * interval '1 day';
  v_tz   text := coalesce((SELECT value #>> '{}' FROM public.platform_settings WHERE setting_key = 'timezone'), 'Australia/Sydney');
  v_ind  text := public.current_industry();
BEGIN
  IF NOT private.has_permission('view_analytics') THEN
    RAISE EXCEPTION 'You do not have permission to view analytics.' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'escalation_reasons', coalesce((SELECT jsonb_agg(x ORDER BY x.n DESC) FROM (
        SELECT coalesce(r.name, 'Other') AS reason, count(*) AS n
        FROM public.escalations e LEFT JOIN public.escalation_rules r ON r.rule_id = e.rule_id
        JOIN public.cases c ON c.case_id = e.case_id AND c.industry = v_ind
        WHERE e.created_at >= v_from GROUP BY 1) x), '[]'),
    'ratings', (SELECT jsonb_object_agg(s, (SELECT count(*) FROM public.feedback f JOIN public.cases c ON c.case_id = f.case_id AND c.industry = v_ind WHERE f.rating = s AND f.created_at >= v_from))
                FROM generate_series(1, 5) s),
    'hours', (SELECT jsonb_agg((SELECT count(*) FROM public.cases c WHERE c.created_at >= v_from AND c.industry = v_ind
                 AND extract(hour FROM c.created_at AT TIME ZONE v_tz) = h) ORDER BY h) FROM generate_series(0, 23) h),
    'weekdays', (SELECT jsonb_agg((SELECT count(*) FROM public.cases c WHERE c.created_at >= v_from AND c.industry = v_ind
                 AND extract(isodow FROM c.created_at AT TIME ZONE v_tz) = d) ORDER BY d) FROM generate_series(1, 7) d),
    'top_articles', coalesce((SELECT jsonb_agg(x ORDER BY x.n DESC) FROM (
        SELECT d.title, count(*) AS n FROM public.knowledge_retrievals k JOIN public.knowledge_documents d USING (document_id)
        WHERE k.retrieved_at >= v_from AND d.industry = v_ind GROUP BY d.title ORDER BY count(*) DESC LIMIT 8) x), '[]'),
    'agents', coalesce((SELECT jsonb_agg(x ORDER BY x.requests DESC) FROM (
        SELECT a.name, a.department, a.status, count(c.case_id) AS requests,
               count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.escalations e WHERE e.case_id = c.case_id) AND c.case_id IS NOT NULL) AS ai_only,
               count(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.escalations e WHERE e.case_id = c.case_id)) AS escalated,
               round(100 * avg(c.confidence))::int AS confidence
        FROM public.ai_agents a LEFT JOIN public.cases c ON c.assigned_agent_id = a.agent_id AND c.created_at >= v_from AND c.industry = v_ind
        WHERE a.type IN ('specialist','orchestrator') AND a.industry IN ('all', v_ind) GROUP BY a.agent_id, a.name, a.department, a.status) x), '[]'),
    'security', coalesce((SELECT jsonb_object_agg(event_type, n) FROM (
        SELECT event_type, count(*) AS n FROM public.security_events WHERE created_at >= v_from GROUP BY 1) x), '{}')
  );
END $$;

-- ---------- Team operations ----------

CREATE OR REPLACE FUNCTION public.team_stats(p_days int DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_days int := CASE WHEN p_days IN (7, 30, 90) THEN p_days ELSE 30 END;
  v_from timestamptz := date_trunc('day', now()) - (v_days - 1) * interval '1 day';
  v_ind  text := public.current_industry();
BEGIN
  IF NOT private.has_permission('view_analytics') THEN
    RAISE EXCEPTION 'You do not have permission to view team operations.' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'people', coalesce((SELECT jsonb_agg(x ORDER BY x.team NULLS LAST, x.name) FROM (
      SELECT u.user_id, u.name, u.role, t.name AS team, u.presence, u.max_active_cases, u.last_active_at,
        (SELECT count(*) FROM public.case_assignments a JOIN public.cases c USING (case_id)
          WHERE a.user_id = u.user_id AND a.status = 'active' AND c.status NOT IN ('resolved','closed') AND c.industry = v_ind) AS active_cases,
        (SELECT count(DISTINCT a.case_id) FROM public.case_assignments a JOIN public.cases c USING (case_id) WHERE a.user_id = u.user_id AND a.assigned_at >= v_from AND c.industry = v_ind) AS taken,
        (SELECT count(DISTINCT a.case_id) FROM public.case_assignments a JOIN public.cases c USING (case_id)
          WHERE a.user_id = u.user_id AND c.resolved_at >= v_from AND c.industry = v_ind) AS resolved,
        (SELECT round(avg(extract(epoch FROM a.assigned_at - e.created_at) / 60))::int
          FROM public.case_assignments a JOIN public.escalations e ON e.case_id = a.case_id
          WHERE a.user_id = u.user_id AND a.assigned_at >= v_from AND a.assigned_at > e.created_at) AS pickup_min,
        (SELECT round(avg(f.rating), 1) FROM public.feedback f JOIN public.case_assignments a ON a.case_id = f.case_id
          WHERE a.user_id = u.user_id AND f.created_at >= v_from) AS rating,
        (SELECT count(*) FROM public.messages m WHERE m.sender_id = u.user_id AND m.sender_type = 'human_agent' AND m.sent_at >= v_from) AS replies
      FROM public.users u LEFT JOIN public.teams t ON t.team_id = u.team_id
      WHERE u.status = 'active' AND (u.role IN ('support_agent','team_leader')
            OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.user_id AND r.role IN ('support_agent','team_leader')))) x), '[]'),
    'queue', jsonb_build_object(
      'waiting', (SELECT count(*) FROM public.cases WHERE status = 'escalated' AND industry = v_ind),
      'oldest_wait_min', (SELECT round(extract(epoch FROM now() - min(e.created_at)) / 60)::int FROM public.escalations e
                          JOIN public.cases c USING (case_id) WHERE c.status = 'escalated' AND c.industry = v_ind),
      'sla_breached', (SELECT count(*) FROM public.cases WHERE status NOT IN ('resolved','closed') AND sla_due_at < now() AND industry = v_ind),
      'unassigned_high', (SELECT count(*) FROM public.cases c WHERE c.status = 'escalated' AND c.priority IN ('high','urgent') AND c.industry = v_ind))
  );
END $$;

-- ---------- 8. sample university cases (only once) ----------
-- Runs the real pipeline as demo students, then spreads the cases over the
-- last 3 weeks and resolves some, so dashboards and analytics have data.
DO $$
DECLARE
  v_was  jsonb := (SELECT value FROM public.platform_settings WHERE setting_key = 'industry');
  v_r    jsonb;
  s      record;
  v_cust uuid[];
  v_user uuid;
  v_i    int := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM public.cases WHERE industry = 'university') THEN RETURN; END IF;
  SELECT array_agg(c.customer_id ORDER BY u.name) INTO v_cust
  FROM public.customers c JOIN public.users u ON u.user_id = c.user_id
  WHERE u.role = 'customer' AND u.status = 'active';
  IF v_cust IS NULL THEN RETURN; END IF;

  UPDATE public.platform_settings SET value = '"university"' WHERE setting_key = 'industry';
  FOR s IN SELECT * FROM (VALUES
    ('When does the Semester 1 intake close for international students?', 19, 'answered', 5),
    ('How do I reset my student password?', 18, 'answered', 5),
    ('Where can I find the exam timetable and my exam venue?', 16, 'answered', 4),
    ('How do I get a new student ID card? I lost mine', 15, 'answered', 5),
    ('Can I set up a payment plan for my tuition fees?', 13, 'answered', 4),
    ('I cannot connect to the campus wifi on my new laptop', 12, 'answered', 3),
    ('I want to apply for special consideration for my final exam because I was sick', 10, 'resolved', 5),
    ('Can I work more hours on my visa during the semester?', 9, 'resolved', 4),
    ('When are results released this semester?', 7, 'answered', 5),
    ('I need a refund for a unit I dropped before census date', 6, 'resolved', 4),
    ('How do I apply for a scholarship?', 4, 'answered', NULL),
    ('I am really stressed about my exams and I cannot cope', 3, 'resolved', 5),
    ('Moodle is not showing my new unit', 2, 'answered', NULL),
    ('Can I get credit for my previous diploma?', 1, 'open', NULL),
    ('My assignment extension request is urgent, the portal is not working', 0, 'open', NULL)
  ) AS t(msg, days_ago, outcome, rating) LOOP
    v_i := v_i + 1;
    SELECT user_id INTO v_user FROM public.customers WHERE customer_id = v_cust[1 + (v_i % array_length(v_cust, 1))];
    v_r := private.handle_enquiry(v_cust[1 + (v_i % array_length(v_cust, 1))], v_user, s.msg);

    -- spread over time (and out of the rate-limit window)
    UPDATE public.cases SET created_at = now() - make_interval(days => s.days_ago, hours => (v_i * 3) % 9),
           updated_at = now() - make_interval(days => s.days_ago), sla_due_at = sla_due_at - make_interval(days => s.days_ago)
     WHERE case_id = (v_r->>'case_id')::uuid;
    UPDATE public.messages SET sent_at = now() - make_interval(days => s.days_ago, hours => (v_i * 3) % 9)
     WHERE conversation_id IN (SELECT conversation_id FROM public.conversations WHERE case_id = (v_r->>'case_id')::uuid);
    UPDATE public.escalations SET created_at = now() - make_interval(days => s.days_ago, hours => (v_i * 3) % 9)
     WHERE case_id = (v_r->>'case_id')::uuid;
    UPDATE public.knowledge_retrievals SET retrieved_at = now() - make_interval(days => s.days_ago)
     WHERE case_id = (v_r->>'case_id')::uuid;

    IF s.outcome = 'resolved' OR (s.outcome = 'answered' AND s.days_ago >= 2) THEN
      -- AI answers are confirmed within minutes; staff cases are closed within a few hours
      UPDATE public.cases SET status = 'resolved' WHERE case_id = (v_r->>'case_id')::uuid;
      UPDATE public.cases SET resolved_at = created_at + CASE WHEN s.outcome = 'answered' THEN interval '20 minutes' ELSE interval '3 hours' END,
             updated_at  = created_at + CASE WHEN s.outcome = 'answered' THEN interval '20 minutes' ELSE interval '3 hours' END
       WHERE case_id = (v_r->>'case_id')::uuid;
    END IF;
    IF s.rating IS NOT NULL THEN
      INSERT INTO public.feedback (case_id, rating, created_at)
      VALUES ((v_r->>'case_id')::uuid, s.rating, now() - make_interval(days => greatest(s.days_ago - 1, 0)));
    END IF;
  END LOOP;
  UPDATE public.platform_settings SET value = v_was WHERE setting_key = 'industry';
END $$;

COMMIT;

-- Check: agents and approved articles per pack
SELECT industry, type, count(*) AS agents FROM public.ai_agents GROUP BY 1, 2 ORDER BY 1, 2;
SELECT industry, category, count(*) AS approved_articles
FROM public.knowledge_documents WHERE status = 'approved' GROUP BY 1, 2 ORDER BY 1, 2;
SELECT industry, status, count(*) AS cases FROM public.cases GROUP BY 1, 2 ORDER BY 1, 2;
