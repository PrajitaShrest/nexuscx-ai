-- NexusCX AI - Seed data (synthetic only, no real personal data)
-- Fixed UUIDs make the demo repeatable. Re-run safely after a reset.
-- Run second in Supabase SQL Editor (already run on 7 Oct 2026)

BEGIN;

-- Users: 5 customers, 2 support agents, 1 team leader, 1 administrator
INSERT INTO users (user_id, name, email, role) VALUES
 ('00000000-0000-0000-0000-000000000001','Alex Nguyen','alex.nguyen@example.test','customer'),
 ('00000000-0000-0000-0000-000000000002','Sam Patel','sam.patel@example.test','customer'),
 ('00000000-0000-0000-0000-000000000003','Jordan Lee','jordan.lee@example.test','customer'),
 ('00000000-0000-0000-0000-000000000004','Taylor Smith','taylor.smith@example.test','customer'),
 ('00000000-0000-0000-0000-000000000005','Casey Brown','casey.brown@example.test','customer'),
 ('00000000-0000-0000-0000-000000000011','Riley Support','riley.support@example.test','support_agent'),
 ('00000000-0000-0000-0000-000000000012','Morgan Support','morgan.support@example.test','support_agent'),
 ('00000000-0000-0000-0000-000000000021','Jamie Lead','jamie.lead@example.test','team_leader'),
 ('00000000-0000-0000-0000-000000000031','Avery Admin','avery.admin@example.test','administrator');

INSERT INTO customers (customer_id, user_id, phone, address) VALUES
 ('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000001','0400 000 001','1 Example St, Sydney NSW'),
 ('00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000000002','0400 000 002','2 Example St, Parramatta NSW'),
 ('00000000-0000-0000-0000-000000000103','00000000-0000-0000-0000-000000000003','0400 000 003','3 Example St, Melbourne VIC'),
 ('00000000-0000-0000-0000-000000000104','00000000-0000-0000-0000-000000000004','0400 000 004','4 Example St, Brisbane QLD'),
 ('00000000-0000-0000-0000-000000000105','00000000-0000-0000-0000-000000000005','0400 000 005','5 Example St, Perth WA');

INSERT INTO ai_agents (agent_id, name, type, description, model_name, status) VALUES
 ('00000000-0000-0000-0000-000000000201','Orchestrator','orchestrator','Receives enquiries and coordinates other agents','llm-general','active'),
 ('00000000-0000-0000-0000-000000000202','Intent Classifier','classifier','Classifies intent, sentiment, risk and confidence','llm-general','active'),
 ('00000000-0000-0000-0000-000000000203','Orders Agent','specialist','Order status, delivery and returns','llm-general','active'),
 ('00000000-0000-0000-0000-000000000204','Billing Agent','specialist','Invoices, charges and payment questions','llm-general','active'),
 ('00000000-0000-0000-0000-000000000205','Technical Support Agent','specialist','Login, app and device troubleshooting','llm-general','active'),
 ('00000000-0000-0000-0000-000000000206','Safety Checker','safety','Checks replies for policy and risk before sending','llm-general','active');

INSERT INTO routing_rules (agent_id, intent, condition, priority) VALUES
 ('00000000-0000-0000-0000-000000000203','order_status','{"max_risk":"medium","min_confidence":0.6}',10),
 ('00000000-0000-0000-0000-000000000203','return_request','{"max_risk":"medium","min_confidence":0.6}',20),
 ('00000000-0000-0000-0000-000000000204','billing_question','{"max_risk":"medium","min_confidence":0.6}',10),
 ('00000000-0000-0000-0000-000000000204','refund_request','{"max_risk":"low","min_confidence":0.8}',5),
 ('00000000-0000-0000-0000-000000000205','technical_issue','{"max_risk":"medium","min_confidence":0.6}',10);

INSERT INTO knowledge_documents (document_id, title, category, content, status, source) VALUES
 ('00000000-0000-0000-0000-000000000301','Delivery times policy','orders','Standard delivery takes 3 to 5 business days within Australia.','approved','Internal policy v1'),
 ('00000000-0000-0000-0000-000000000302','Returns policy','orders','Items can be returned within 30 days with proof of purchase.','approved','Internal policy v1'),
 ('00000000-0000-0000-0000-000000000303','Refund policy','billing','Refunds are reviewed and approved by staff only. AI agents may explain the process but cannot issue refunds.','approved','Internal policy v1'),
 ('00000000-0000-0000-0000-000000000304','Password reset FAQ','technical','Use the Forgot password link on the sign-in page. The link expires after 30 minutes.','approved','Support FAQ'),
 ('00000000-0000-0000-0000-000000000305','Invoice download guide','billing','Invoices are available under Account > Billing > Invoices.','draft','Support FAQ draft');

-- Cases (varied status, risk and confidence for the demo)
INSERT INTO cases (case_id, customer_id, status, priority, intent, sentiment, urgency, risk, confidence, created_at, closed_at) VALUES
 ('00000000-0000-0000-0000-000000000401','00000000-0000-0000-0000-000000000101','open','medium','order_status','neutral','medium','low',0.920, now() - interval '2 hours', NULL),
 ('00000000-0000-0000-0000-000000000402','00000000-0000-0000-0000-000000000102','escalated','high','refund_request','negative','high','high',0.880, now() - interval '5 hours', NULL),
 ('00000000-0000-0000-0000-000000000403','00000000-0000-0000-0000-000000000103','in_progress','medium','technical_issue','neutral','medium','low',0.850, now() - interval '1 day', NULL),
 ('00000000-0000-0000-0000-000000000404','00000000-0000-0000-0000-000000000104','escalated','medium','billing_question','negative','medium','medium',0.450, now() - interval '3 hours', NULL),
 ('00000000-0000-0000-0000-000000000405','00000000-0000-0000-0000-000000000105','resolved','low','return_request','positive','low','low',0.950, now() - interval '3 days', now() - interval '2 days'),
 ('00000000-0000-0000-0000-000000000406','00000000-0000-0000-0000-000000000101','open','low','technical_issue','neutral','low','low',0.780, now() - interval '30 minutes', NULL);

INSERT INTO conversations (conversation_id, case_id, channel, started_at, ended_at) VALUES
 ('00000000-0000-0000-0000-000000000501','00000000-0000-0000-0000-000000000401','web_chat', now() - interval '2 hours', NULL),
 ('00000000-0000-0000-0000-000000000502','00000000-0000-0000-0000-000000000402','web_chat', now() - interval '5 hours', NULL),
 ('00000000-0000-0000-0000-000000000503','00000000-0000-0000-0000-000000000403','email',    now() - interval '1 day', NULL),
 ('00000000-0000-0000-0000-000000000504','00000000-0000-0000-0000-000000000404','web_chat', now() - interval '3 hours', NULL),
 ('00000000-0000-0000-0000-000000000505','00000000-0000-0000-0000-000000000405','web_form', now() - interval '3 days', now() - interval '2 days'),
 ('00000000-0000-0000-0000-000000000506','00000000-0000-0000-0000-000000000406','web_chat', now() - interval '30 minutes', NULL);

INSERT INTO messages (conversation_id, sender_type, sender_id, content, sent_at) VALUES
 ('00000000-0000-0000-0000-000000000501','customer','00000000-0000-0000-0000-000000000001','Where is my order #A1001?', now() - interval '2 hours'),
 ('00000000-0000-0000-0000-000000000501','ai_agent','00000000-0000-0000-0000-000000000203','Standard delivery takes 3 to 5 business days. Your order is on its way.', now() - interval '119 minutes'),
 ('00000000-0000-0000-0000-000000000502','customer','00000000-0000-0000-0000-000000000002','I was charged twice. I want a refund now.', now() - interval '5 hours'),
 ('00000000-0000-0000-0000-000000000502','system',NULL,'This request needs staff approval. A support agent will contact you.', now() - interval '299 minutes'),
 ('00000000-0000-0000-0000-000000000503','customer','00000000-0000-0000-0000-000000000003','I cannot log in to the app.', now() - interval '1 day'),
 ('00000000-0000-0000-0000-000000000503','ai_agent','00000000-0000-0000-0000-000000000205','Please use the Forgot password link on the sign-in page.', now() - interval '1439 minutes'),
 ('00000000-0000-0000-0000-000000000504','customer','00000000-0000-0000-0000-000000000004','My invoice amount looks wrong.', now() - interval '3 hours'),
 ('00000000-0000-0000-0000-000000000505','customer','00000000-0000-0000-0000-000000000005','How do I return a jacket?', now() - interval '3 days'),
 ('00000000-0000-0000-0000-000000000505','ai_agent','00000000-0000-0000-0000-000000000203','Items can be returned within 30 days with proof of purchase.', now() - interval '4319 minutes'),
 ('00000000-0000-0000-0000-000000000506','customer','00000000-0000-0000-0000-000000000001','The app crashes when I open settings.', now() - interval '30 minutes');

INSERT INTO classifications (case_id, agent_id, intent, sentiment, urgency, risk, language, confidence) VALUES
 ('00000000-0000-0000-0000-000000000401','00000000-0000-0000-0000-000000000202','order_status','neutral','medium','low','en',0.920),
 ('00000000-0000-0000-0000-000000000402','00000000-0000-0000-0000-000000000202','refund_request','negative','high','high','en',0.880),
 ('00000000-0000-0000-0000-000000000403','00000000-0000-0000-0000-000000000202','technical_issue','neutral','medium','low','en',0.850),
 ('00000000-0000-0000-0000-000000000404','00000000-0000-0000-0000-000000000202','billing_question','negative','medium','medium','en',0.450),
 ('00000000-0000-0000-0000-000000000405','00000000-0000-0000-0000-000000000202','return_request','positive','low','low','en',0.950),
 ('00000000-0000-0000-0000-000000000406','00000000-0000-0000-0000-000000000202','technical_issue','neutral','low','low','en',0.780);

INSERT INTO escalations (case_id, reason, escalated_from, escalated_to, status) VALUES
 ('00000000-0000-0000-0000-000000000402','High-impact action: refund requires staff approval','billing_agent','human_support_queue','accepted'),
 ('00000000-0000-0000-0000-000000000404','Low confidence (0.45) below threshold 0.60','billing_agent','human_support_queue','pending');

INSERT INTO case_assignments (case_id, user_id, status) VALUES
 ('00000000-0000-0000-0000-000000000402','00000000-0000-0000-0000-000000000011','active'),
 ('00000000-0000-0000-0000-000000000403','00000000-0000-0000-0000-000000000012','active'),
 ('00000000-0000-0000-0000-000000000405','00000000-0000-0000-0000-000000000011','completed');

INSERT INTO feedback (case_id, rating, comment) VALUES
 ('00000000-0000-0000-0000-000000000405',5,'Quick and clear answer.');

INSERT INTO audit_logs (user_id, actor, action, entity_type, entity_id, details) VALUES
 (NULL,'billing_agent','case_escalated','cases','00000000-0000-0000-0000-000000000402','{"reason":"refund_request"}'),
 ('00000000-0000-0000-0000-000000000011','support_agent','case_assigned','cases','00000000-0000-0000-0000-000000000402','{"assigned_to":"Riley Support"}'),
 (NULL,'billing_agent','case_escalated','cases','00000000-0000-0000-0000-000000000404','{"reason":"low_confidence","confidence":0.45}'),
 ('00000000-0000-0000-0000-000000000011','support_agent','case_resolved','cases','00000000-0000-0000-0000-000000000405',NULL),
 ('00000000-0000-0000-0000-000000000031','administrator','document_approved','knowledge_documents','00000000-0000-0000-0000-000000000303',NULL);

-- Agent Builder sample (Should Have feature, seeded so the tables are not empty)
INSERT INTO agent_builder_requests (request_id, user_id, agent_name, department, business_goal, requirements, status) VALUES
 ('00000000-0000-0000-0000-000000000601','00000000-0000-0000-0000-000000000031','Warranty Agent','after_sales','Answer warranty questions using the warranty policy','Must escalate any claim over $500','in_review');

INSERT INTO agent_config_versions (config_id, request_id, agent_id, created_by_user_id, config_data, version, status) VALUES
 ('00000000-0000-0000-0000-000000000701','00000000-0000-0000-0000-000000000601',NULL,'00000000-0000-0000-0000-000000000031','{"system_prompt":"You answer warranty questions only.","escalate_if":{"claim_value_over":500}}',1,'testing');

INSERT INTO agent_knowledge_sources (config_id, document_id) VALUES
 ('00000000-0000-0000-0000-000000000701','00000000-0000-0000-0000-000000000302'),
 ('00000000-0000-0000-0000-000000000701','00000000-0000-0000-0000-000000000303');

INSERT INTO agent_tests (config_id, scenario_prompt, expected_outcome, actual_result, passed, tested_at) VALUES
 ('00000000-0000-0000-0000-000000000701','My kettle broke after 2 months. Is it covered?','Explains warranty and next steps','Explained warranty and next steps',true, now()),
 ('00000000-0000-0000-0000-000000000701','My $900 TV broke. Refund me now.','Escalates to human (claim over $500)','Escalated to human',true, now());

COMMIT;
