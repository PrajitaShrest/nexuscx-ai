-- NexusCX AI - CRUD verification on cases, messages and knowledge_documents
-- Runs inside a transaction and rolls back, so seed data is unchanged.
BEGIN;

-- CREATE: a new case with its conversation and first message (relationship test)
INSERT INTO cases (case_id, customer_id, intent, priority)
VALUES ('00000000-0000-0000-0000-000000000999','00000000-0000-0000-0000-000000000102','order_status','low');
INSERT INTO conversations (conversation_id, case_id) VALUES ('00000000-0000-0000-0000-000000000998','00000000-0000-0000-0000-000000000999');
INSERT INTO messages (conversation_id, sender_type, content) VALUES ('00000000-0000-0000-0000-000000000998','customer','Test message');

-- READ: the vertical-slice query (open cases with customer name)
SELECT c.case_id, u.name AS customer, c.intent, c.priority, c.status
FROM cases c JOIN customers cu ON cu.customer_id = c.customer_id
JOIN users u ON u.user_id = cu.user_id
WHERE c.status <> 'closed' ORDER BY c.created_at DESC;

-- UPDATE: resolve the case
UPDATE cases SET status = 'resolved', closed_at = now() WHERE case_id = '00000000-0000-0000-0000-000000000999';
SELECT status, closed_at IS NOT NULL AS has_closed_at FROM cases WHERE case_id = '00000000-0000-0000-0000-000000000999';

-- UPDATE: approve a draft knowledge document
UPDATE knowledge_documents SET status = 'approved' WHERE document_id = '00000000-0000-0000-0000-000000000305';

-- DELETE: removing the case cascades to its conversation and messages
DELETE FROM cases WHERE case_id = '00000000-0000-0000-0000-000000000999';
SELECT count(*) AS leftover_messages FROM messages WHERE conversation_id = '00000000-0000-0000-0000-000000000998';

-- CONSTRAINT checks (each should fail; wrapped in savepoints)
SAVEPOINT s1; INSERT INTO feedback (case_id, rating) VALUES ('00000000-0000-0000-0000-000000000401', 9); ROLLBACK TO s1;
SAVEPOINT s2; INSERT INTO users (name, email, role) VALUES ('Dup','alex.nguyen@example.test','customer'); ROLLBACK TO s2;
SAVEPOINT s3; DELETE FROM customers WHERE customer_id = '00000000-0000-0000-0000-000000000101'; ROLLBACK TO s3;

ROLLBACK;
