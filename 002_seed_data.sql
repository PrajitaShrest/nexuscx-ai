-- =============================================================
-- NexusCX AI - Week 5 seed data
-- Run AFTER 001_create_tables.sql
-- (Supabase SQL Editor -> New query -> paste -> Run)
--
-- All data is FAKE and matches the Figma prototype screens.
-- No real people. Emails use the reserved .test domain.
-- UUIDs are fixed and readable so rows are easy to link:
--   1111... = users          2222... = customers
--   3333... = ai_agents      4444... = knowledge_documents
--   5555... = cases          6666... = conversations
--   7777... = messages       8888... = classifications
--   9999... = escalations
-- Times are Sydney time (+11:00).
-- =============================================================

-- -------------------------------------------------------------
-- 1. users (7 customers + 4 staff, one for each staff role)
-- -------------------------------------------------------------
INSERT INTO users (user_id, name, email, role, status) VALUES
('11111111-0000-0000-0000-000000000001', 'Sarah Chen',     'sarah.chen@example.test',     'customer',      'active'),
('11111111-0000-0000-0000-000000000002', 'James Wilson',   'james.wilson@example.test',   'customer',      'active'),
('11111111-0000-0000-0000-000000000003', 'Maya Patel',     'maya.patel@example.test',     'customer',      'active'),
('11111111-0000-0000-0000-000000000004', 'David Kim',      'david.kim@example.test',      'customer',      'active'),
('11111111-0000-0000-0000-000000000005', 'Emma Rodriguez', 'emma.rodriguez@example.test', 'customer',      'active'),
('11111111-0000-0000-0000-000000000006', 'Thomas Lee',     'thomas.lee@example.test',     'customer',      'active'),
('11111111-0000-0000-0000-000000000007', 'Priya Sharma',   'priya.sharma@example.test',   'customer',      'inactive'),
('11111111-0000-0000-0000-000000000011', 'Alex Morgan',    'alex.morgan@nexuscx.test',    'support_agent', 'active'),
('11111111-0000-0000-0000-000000000012', 'Jordan Blake',   'jordan.blake@nexuscx.test',   'support_agent', 'active'),
('11111111-0000-0000-0000-000000000013', 'Ethan Walker',   'ethan.walker@nexuscx.test',   'team_leader',   'active'),
('11111111-0000-0000-0000-000000000014', 'Sophie Martin',  'sophie.martin@nexuscx.test',  'admin',         'active');

-- -------------------------------------------------------------
-- 2. customers (one profile for each customer user)
-- -------------------------------------------------------------
INSERT INTO customers (customer_id, user_id, phone, address) VALUES
('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', '0400 000 001', '12 Example St, Sydney NSW 2000'),
('22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000002', '0400 000 002', '45 Sample Rd, Parramatta NSW 2150'),
('22222222-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000003', NULL,           '8 Test Ave, Melbourne VIC 3000'),
('22222222-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000004', '0400 000 004', NULL),
('22222222-0000-0000-0000-000000000005', '11111111-0000-0000-0000-000000000005', '0400 000 005', '3 Demo Lane, Brisbane QLD 4000'),
('22222222-0000-0000-0000-000000000006', '11111111-0000-0000-0000-000000000006', '0400 000 006', '27 Mock Pde, Perth WA 6000'),
('22222222-0000-0000-0000-000000000007', '11111111-0000-0000-0000-000000000007', NULL,           NULL);

-- -------------------------------------------------------------
-- 3. ai_agents (orchestrator + 3 specialists, as in the prototype)
-- -------------------------------------------------------------
INSERT INTO ai_agents (agent_id, name, type, description, model_name, status) VALUES
('33333333-0000-0000-0000-000000000001', 'AI Orchestrator', 'orchestrator',      'Classifies each enquiry and routes it to the right specialist agent.', 'gpt-4o-mini', 'active'),
('33333333-0000-0000-0000-000000000002', 'Technical Agent', 'technical_support', 'Handles login problems, app errors and how-to questions.',            'gpt-4o-mini', 'active'),
('33333333-0000-0000-0000-000000000003', 'Order Agent',     'orders',            'Handles order status, delivery and returns questions.',               'gpt-4o-mini', 'active'),
('33333333-0000-0000-0000-000000000004', 'Billing Agent',   'billing',           'Explains invoices and charges. Refunds are escalated to a human.',    'gpt-4o-mini', 'active');

-- -------------------------------------------------------------
-- 4. knowledge_documents (6 approved, 1 draft)
--    The draft must NOT be used by the AI - good to show in demo
-- -------------------------------------------------------------
INSERT INTO knowledge_documents (document_id, title, category, content, status, source) VALUES
('44444444-0000-0000-0000-000000000001', 'Billing Policy v4.2', 'billing',
 'Customers are billed monthly on their sign-up date. Invoices list each charge, GST and the total, and are available under Account > Billing.',
 'approved', 'Finance team'),
('44444444-0000-0000-0000-000000000002', 'Refund Procedure v2.1', 'billing',
 'Refunds must be approved by a human staff member. The AI assistant can explain the process but cannot issue a refund.',
 'approved', 'Finance team'),
('44444444-0000-0000-0000-000000000003', 'Payment Terms v3.0', 'billing',
 'Payment is due within 14 days of the invoice date. Duplicate charges are reversed within 5 business days once confirmed.',
 'approved', 'Finance team'),
('44444444-0000-0000-0000-000000000004', 'Delivery Times', 'orders',
 'Standard delivery takes 3-5 business days in metro areas and 5-8 business days in regional areas.',
 'approved', 'Shipping Policy 2026'),
('44444444-0000-0000-0000-000000000005', 'Missing or Damaged Items', 'orders',
 'If an item is missing or damaged, the customer can report it within 7 days of delivery for a replacement.',
 'approved', 'Returns Policy 2026'),
('44444444-0000-0000-0000-000000000006', 'Password Reset Guide', 'technical',
 'Click "Forgot password" on the login page. A reset link is emailed within 5 minutes and expires after 1 hour.',
 'approved', 'Help Centre'),
('44444444-0000-0000-0000-000000000007', 'New Loyalty Program (draft)', 'general',
 'Draft content - not yet approved by the administrator.',
 'draft', 'Marketing team');

-- -------------------------------------------------------------
-- 5. cases (the 7 cases from the prototype's Case Queue)
--    assigned_agent_id NULL = waiting in the Human Queue
-- -------------------------------------------------------------
INSERT INTO cases (case_id, case_number, customer_id, assigned_agent_id, subject, status, priority, created_at, closed_at) VALUES
('55555555-0000-0000-0000-000000000001', 10422, '22222222-0000-0000-0000-000000000007', '33333333-0000-0000-0000-000000000004', 'Upgrade plan enquiry',           'resolved',    'low',    '2026-10-07 08:40:00+11', '2026-10-07 08:52:00+11'),
('55555555-0000-0000-0000-000000000002', 10423, '22222222-0000-0000-0000-000000000006', NULL,                                   'Missing item in order',          'escalated',   'high',   '2026-10-07 08:55:00+11', NULL),
('55555555-0000-0000-0000-000000000003', 10424, '22222222-0000-0000-0000-000000000005', '33333333-0000-0000-0000-000000000002', 'Password reset not working',     'waiting',     'normal', '2026-10-07 09:10:00+11', NULL),
('55555555-0000-0000-0000-000000000004', 10425, '22222222-0000-0000-0000-000000000004', '33333333-0000-0000-0000-000000000004', 'Invoice explanation Q3',         'ai_handling', 'normal', '2026-10-07 09:20:00+11', NULL),
('55555555-0000-0000-0000-000000000005', 10426, '22222222-0000-0000-0000-000000000003', '33333333-0000-0000-0000-000000000002', 'AUTH-403 Login Error',           'escalated',   'high',   '2026-10-07 09:28:00+11', NULL),
('55555555-0000-0000-0000-000000000006', 10427, '22222222-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000003', 'Order #ORD-88219 Not Arrived',   'ai_handling', 'medium', '2026-10-07 09:35:00+11', NULL),
('55555555-0000-0000-0000-000000000007', 10428, '22222222-0000-0000-0000-000000000001', NULL,                                   'Duplicate Subscription Payment', 'escalated',   'high',   '2026-10-07 09:41:00+11', NULL);

-- New cases continue from CX-10429
SELECT setval(pg_get_serial_sequence('cases', 'case_number'), (SELECT max(case_number) FROM cases));

-- -------------------------------------------------------------
-- 6. conversations (one web chat per case)
-- -------------------------------------------------------------
INSERT INTO conversations (conversation_id, case_id, channel, started_at, ended_at) VALUES
('66666666-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000001', 'web_chat', '2026-10-07 08:40:00+11', '2026-10-07 08:52:00+11'),
('66666666-0000-0000-0000-000000000002', '55555555-0000-0000-0000-000000000002', 'web_chat', '2026-10-07 08:55:00+11', NULL),
('66666666-0000-0000-0000-000000000003', '55555555-0000-0000-0000-000000000003', 'web_chat', '2026-10-07 09:10:00+11', NULL),
('66666666-0000-0000-0000-000000000004', '55555555-0000-0000-0000-000000000004', 'email',    '2026-10-07 09:20:00+11', NULL),
('66666666-0000-0000-0000-000000000005', '55555555-0000-0000-0000-000000000005', 'web_chat', '2026-10-07 09:28:00+11', NULL),
('66666666-0000-0000-0000-000000000006', '55555555-0000-0000-0000-000000000006', 'web_chat', '2026-10-07 09:35:00+11', NULL),
('66666666-0000-0000-0000-000000000007', '55555555-0000-0000-0000-000000000007', 'web_chat', '2026-10-07 09:41:00+11', NULL);

-- -------------------------------------------------------------
-- 7. messages
-- -------------------------------------------------------------
INSERT INTO messages (message_id, conversation_id, sender_type, sender_id, content, message_type, "timestamp") VALUES
-- CX-10422 Upgrade plan - solved by AI
('77777777-0000-0000-0000-000000000001', '66666666-0000-0000-0000-000000000001', 'customer', '11111111-0000-0000-0000-000000000007', 'How do I upgrade to the Professional plan?', 'text', '2026-10-07 08:40:00+11'),
('77777777-0000-0000-0000-000000000002', '66666666-0000-0000-0000-000000000001', 'ai',       '33333333-0000-0000-0000-000000000004', 'You can upgrade any time under Account > Billing > Change plan. The new price applies from your next billing date.', 'text', '2026-10-07 08:40:20+11'),
-- CX-10423 Missing item - escalated
('77777777-0000-0000-0000-000000000003', '66666666-0000-0000-0000-000000000002', 'customer', '11111111-0000-0000-0000-000000000006', 'My order arrived but one item is missing. I paid for it!', 'text', '2026-10-07 08:55:00+11'),
('77777777-0000-0000-0000-000000000004', '66666666-0000-0000-0000-000000000002', 'system',   NULL, 'Replacement request needs staff approval. Case escalated to Human Queue.', 'system_note', '2026-10-07 08:55:15+11'),
-- CX-10424 Password reset - waiting for customer
('77777777-0000-0000-0000-000000000005', '66666666-0000-0000-0000-000000000003', 'customer', '11111111-0000-0000-0000-000000000005', 'The password reset link is not working.', 'text', '2026-10-07 09:10:00+11'),
('77777777-0000-0000-0000-000000000006', '66666666-0000-0000-0000-000000000003', 'ai',       '33333333-0000-0000-0000-000000000002', 'Reset links expire after 1 hour. I have sent a new link - can you try it and let me know?', 'text', '2026-10-07 09:10:20+11'),
-- CX-10425 Invoice question - AI handling
('77777777-0000-0000-0000-000000000007', '66666666-0000-0000-0000-000000000004', 'customer', '11111111-0000-0000-0000-000000000004', 'Can you explain the charges on my Q3 invoice?', 'text', '2026-10-07 09:20:00+11'),
('77777777-0000-0000-0000-000000000008', '66666666-0000-0000-0000-000000000004', 'ai',       '33333333-0000-0000-0000-000000000004', 'Your invoice lists each monthly charge plus GST. Would you like me to go through each line?', 'text', '2026-10-07 09:20:25+11'),
-- CX-10426 Login error - escalated
('77777777-0000-0000-0000-000000000009', '66666666-0000-0000-0000-000000000005', 'customer', '11111111-0000-0000-0000-000000000003', 'I keep getting AUTH-403 when I log in. I cannot access anything.', 'text', '2026-10-07 09:28:00+11'),
('77777777-0000-0000-0000-000000000010', '66666666-0000-0000-0000-000000000005', 'system',   NULL, 'Account access issue with high risk. Case escalated to support agent.', 'system_note', '2026-10-07 09:28:20+11'),
-- CX-10427 Order not arrived - AI handling
('77777777-0000-0000-0000-000000000011', '66666666-0000-0000-0000-000000000006', 'customer', '11111111-0000-0000-0000-000000000002', 'Order #ORD-88219 has not arrived yet.', 'text', '2026-10-07 09:35:00+11'),
('77777777-0000-0000-0000-000000000012', '66666666-0000-0000-0000-000000000006', 'ai',       '33333333-0000-0000-0000-000000000003', 'Standard delivery to metro areas takes 3-5 business days. Your order is in transit and due tomorrow.', 'text', '2026-10-07 09:35:20+11'),
-- CX-10428 Duplicate payment - escalated (refund = restricted action)
('77777777-0000-0000-0000-000000000013', '66666666-0000-0000-0000-000000000007', 'customer', '11111111-0000-0000-0000-000000000001', 'Hi, I was charged twice for my subscription this month. I need the extra payment refunded.', 'text', '2026-10-07 09:41:00+11'),
('77777777-0000-0000-0000-000000000014', '66666666-0000-0000-0000-000000000007', 'ai',       '33333333-0000-0000-0000-000000000004', 'I am sorry about this. Refunds need approval from our staff, so I have passed your case to a support agent.', 'text', '2026-10-07 09:41:25+11'),
('77777777-0000-0000-0000-000000000015', '66666666-0000-0000-0000-000000000007', 'system',   NULL, 'Refund is a restricted action. Case escalated to Human Queue.', 'system_note', '2026-10-07 09:41:26+11');

-- -------------------------------------------------------------
-- 8. classifications (one per case, made by the orchestrator)
-- -------------------------------------------------------------
INSERT INTO classifications (classification_id, case_id, agent_id, intent, sentiment, urgency, risk, language, confidence, created_at) VALUES
('88888888-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 'billing',   'positive', 'low',    'low',    'en', 0.970, '2026-10-07 08:40:05+11'),
('88888888-0000-0000-0000-000000000002', '55555555-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000001', 'order',     'negative', 'high',   'medium', 'en', 0.890, '2026-10-07 08:55:05+11'),
('88888888-0000-0000-0000-000000000003', '55555555-0000-0000-0000-000000000003', '33333333-0000-0000-0000-000000000001', 'technical', 'neutral',  'medium', 'low',    'en', 0.930, '2026-10-07 09:10:05+11'),
('88888888-0000-0000-0000-000000000004', '55555555-0000-0000-0000-000000000004', '33333333-0000-0000-0000-000000000001', 'billing',   'neutral',  'low',    'low',    'en', 0.910, '2026-10-07 09:20:05+11'),
('88888888-0000-0000-0000-000000000005', '55555555-0000-0000-0000-000000000005', '33333333-0000-0000-0000-000000000001', 'technical', 'negative', 'high',   'high',   'en', 0.620, '2026-10-07 09:28:05+11'),
('88888888-0000-0000-0000-000000000006', '55555555-0000-0000-0000-000000000006', '33333333-0000-0000-0000-000000000001', 'order',     'neutral',  'medium', 'low',    'en', 0.940, '2026-10-07 09:35:05+11'),
('88888888-0000-0000-0000-000000000007', '55555555-0000-0000-0000-000000000007', '33333333-0000-0000-0000-000000000001', 'billing',   'angry',    'high',   'high',   'en', 0.960, '2026-10-07 09:41:05+11');

-- -------------------------------------------------------------
-- 9. escalations (the three escalated cases)
-- -------------------------------------------------------------
INSERT INTO escalations (escalation_id, case_id, reason, escalated_from, escalated_to, created_at, status) VALUES
('99999999-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000002', 'Replacement request - restricted action needs staff approval', 'order_agent',   'human_queue',   '2026-10-07 08:55:15+11', 'pending'),
('99999999-0000-0000-0000-000000000002', '55555555-0000-0000-0000-000000000005', 'High risk account access issue, confidence 0.62',            'orchestrator',  'support_agent', '2026-10-07 09:28:20+11', 'accepted'),
('99999999-0000-0000-0000-000000000003', '55555555-0000-0000-0000-000000000007', 'Refund request - restricted action needs human approval',     'billing_agent', 'human_queue',   '2026-10-07 09:41:26+11', 'pending');
