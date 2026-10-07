-- =============================================================
-- NexusCX AI - CRUD tests (Create, Read, Update, Delete)
-- Run AFTER 001 and 002.
--
-- HOW TO RUN in the Supabase SQL Editor:
--   Highlight ONE test block with your mouse, then click Run.
--   (The editor only shows the result of the last statement,
--    so run the tests one at a time, in order.)
-- Test 4 deletes the test case, so seed data ends up unchanged.
-- Take a screenshot of each result for /docs.
-- =============================================================


-- -------------------------------------------------------------
-- TEST 1 - READ with relationships (JOIN across 4 tables)
-- The same data the "Cases" page shows.
-- -------------------------------------------------------------
SELECT 'CX-' || c.case_number AS case_no,
       u.name        AS customer,
       c.subject,
       a.name        AS assigned_to,
       c.status,
       c.priority,
       cl.intent,
       cl.risk,
       cl.confidence,
       c.created_at
FROM cases c
JOIN customers cu            ON cu.customer_id = c.customer_id
JOIN users u                 ON u.user_id      = cu.user_id
LEFT JOIN classifications cl ON cl.case_id     = c.case_id
LEFT JOIN ai_agents a        ON a.agent_id     = c.assigned_agent_id
ORDER BY c.created_at DESC;


-- -------------------------------------------------------------
-- TEST 2 - CREATE a new case, conversation and message
-- Expected: 1 row, case number CX-10429, status ai_handling
-- -------------------------------------------------------------
INSERT INTO cases (case_id, customer_id, subject, priority)
VALUES ('55555555-0000-0000-0000-000000000099', '22222222-0000-0000-0000-000000000002',
        'Test case: store opening hours', 'low');

INSERT INTO conversations (conversation_id, case_id)
VALUES ('66666666-0000-0000-0000-000000000099', '55555555-0000-0000-0000-000000000099');

INSERT INTO messages (conversation_id, sender_type, sender_id, content)
VALUES ('66666666-0000-0000-0000-000000000099', 'customer',
        '11111111-0000-0000-0000-000000000002', 'Test message: is the store open on Sunday?');

SELECT 'CX-' || c.case_number AS case_no, c.subject, c.status, c.priority, m.content
FROM cases c
JOIN conversations cv ON cv.case_id = c.case_id
JOIN messages m       ON m.conversation_id = cv.conversation_id
WHERE c.case_id = '55555555-0000-0000-0000-000000000099';


-- -------------------------------------------------------------
-- TEST 3 - UPDATE: a support agent resolves the case
-- Expected: status = resolved, closed_at filled in
-- -------------------------------------------------------------
UPDATE cases
SET status = 'resolved', closed_at = now()
WHERE case_id = '55555555-0000-0000-0000-000000000099';

SELECT case_id, status, closed_at
FROM cases
WHERE case_id = '55555555-0000-0000-0000-000000000099';


-- -------------------------------------------------------------
-- TEST 4 - DELETE with CASCADE
-- Deleting the case also deletes its conversation and messages.
-- Expected: 0 | 0 | 0
-- -------------------------------------------------------------
DELETE FROM cases WHERE case_id = '55555555-0000-0000-0000-000000000099';

SELECT
  (SELECT count(*) FROM cases         WHERE case_id = '55555555-0000-0000-0000-000000000099')         AS cases_left,
  (SELECT count(*) FROM conversations WHERE case_id = '55555555-0000-0000-0000-000000000099')         AS conversations_left,
  (SELECT count(*) FROM messages      WHERE conversation_id = '66666666-0000-0000-0000-000000000099') AS messages_left;


-- -------------------------------------------------------------
-- TEST 5 - Constraints protect the data
-- Each statement below SHOULD FAIL with an error. That is a pass.
-- Highlight and run ONE line at a time.
-- -------------------------------------------------------------

-- 5a. Invalid role -> violates check constraint "chk_users_role"
INSERT INTO users (name, email, role) VALUES ('Bad Role', 'bad@example.test', 'boss');

-- 5b. Confidence above 1 -> violates check constraint "chk_classifications_confidence"
UPDATE classifications SET confidence = 1.5 WHERE classification_id = '88888888-0000-0000-0000-000000000001';

-- 5c. Customer with cases cannot be deleted (RESTRICT) -> violates foreign key constraint "fk_cases_customer"
DELETE FROM customers WHERE customer_id = '22222222-0000-0000-0000-000000000001';

-- 5d. Duplicate email -> violates unique constraint "uq_users_email"
INSERT INTO users (name, email, role) VALUES ('Copy', 'sarah.chen@example.test', 'customer');
