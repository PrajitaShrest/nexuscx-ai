# Schema changes from the Week 4 ERD

Every place the built database differs from the approved Week 4 ERD, and why.

| # | Date | Change | Reason |
|---|------|--------|--------|
| 1 | 07/10/2026 | Built 9 core tables only. Not yet built: case_assignments, routing_rules, feedback, audit_logs, agent_builder_requests, agent_config_versions, agent_tests, agent_knowledge_sources. | MVP scope for Week 5. These stay in the ERD and are planned for later sprints. |
| 2 | 07/10/2026 | Removed intent, sentiment, urgency, risk and confidence from `cases`. They are stored only in `classifications`. | The same data was in two tables. Keeping it in one place follows our normalisation note. |
| 3 | 07/10/2026 | `customers.user_id` is now UNIQUE (one customer profile per user). ERD showed 1 to 0..*. | A user should only have one customer profile. |
| 4 | 07/10/2026 | `messages.sender_id` has no foreign key. | A sender can be a user or an AI agent, so it cannot point to one table. `sender_type` says which. |
| 5 | 07/10/2026 | Added CHECK rules for allowed values (role, status, priority, risk, etc.) and `confidence` between 0 and 1. | Stops invalid data being saved. |
| 6 | 07/10/2026 | Added `cases.subject`. | The prototype's Case Queue shows an "Issue" title for each case. The ERD had nowhere to store it. |
| 7 | 07/10/2026 | Added `cases.case_number` (auto-numbered, unique). | The prototype shows friendly IDs like CX-10428. Staff and customers cannot read UUIDs. |
| 8 | 07/10/2026 | Added `cases.assigned_agent_id` (FK to `ai_agents`, ON DELETE SET NULL). NULL = waiting in the human queue. | The prototype shows "Assigned To" for each case. Human assignment stays in the planned `case_assignments` table. |
| 9 | 07/10/2026 | Case statuses changed to ai_handling, waiting, escalated, resolved, closed. Priorities: low, normal, medium, high. Sentiment adds "angry". | To match the values shown in the prototype screens. |
| 10 | 07/10/2026 | Moved from MySQL (local) to PostgreSQL on Supabase. The earlier MySQL scripts are kept in `/database/mysql` for the record. | Team chose Supabase: one shared online database, built-in login and API, free tier. |
| 11 | 07/10/2026 | Turned on Row Level Security for all tables. The browser can only read cases, customers, users, classifications and ai_agents (read-only, Week 5 demo). | Supabase exposes tables to the browser. RLS blocks everything not explicitly allowed. To be replaced with role-based rules once login is built in Week 6. |
