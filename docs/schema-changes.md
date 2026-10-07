# Schema changes from the Week 4 ERD

| # | Change | Reason |
|---|--------|--------|
| 1 | `messages.timestamp` renamed to `sent_at`; `audit_logs.timestamp` renamed to `created_at` | `timestamp` is an SQL type name. Clearer column names. |
| 2 | Added `agent_config_versions.request_id` (FK to `agent_builder_requests`) | The ERD shows a 1 : 0..* link between requests and config versions but no foreign key column. |
| 3 | `customers.user_id` set UNIQUE | Enforces the 1 : 1 link between a customer profile and a user. |
| 4 | `feedback.case_id` set UNIQUE | Enforces the ERD cardinality of 0..1 feedback per case. |
| 5 | `audit_logs.user_id` and `agent_config_versions.agent_id` nullable | Matches the `UUID?` in the ERD: AI actions have no user, and a draft config has no live agent yet. |
| 6 | Allowed values added as CHECK constraints (role, status, priority, risk, rating 1-5, confidence 0-1) | Stops invalid data at the database level. |
| 7 | `routing_rules.condition` and `agent_config_versions.config_data` stored as JSONB | These hold structured settings that vary per rule or agent. |

## Migration 004 – align with the Figma prototype (8 Oct 2026)

After reviewing all 17 prototype screens, the schema was extended. Nothing was removed; existing rows were mapped to the new value names.

| # | Change | Reason (prototype screen) |
|---|--------|---------------------------|
| 8 | New tables `teams`, `role_permissions`; users get `team_id`, `presence`, `last_active_at`, `max_active_cases`; roles add `knowledge_manager`, `business_specialist` | Users & Roles, Team Operations |
| 9 | Cases get `case_number` (CX-10401…), `subject`, `language`, `assigned_agent_id`, `sla_due_at`, `first_response_at`, `updated_at` | Cases queue, Conversations, Dashboard live queue |
| 10 | Case status list changed to ai_handling, human_handling, waiting, escalated, resolved, closed (open → ai_handling, in_progress → human_handling) | Status badges in every queue |
| 11 | Added sentiment `angry`, urgency/risk `critical`, priority `normal`, channel `phone`, new message types | Value lists shown in the prototype |
| 12 | New table `message_citations` | "[1] Billing Policy v4.2 – Section 5.3" under AI replies |
| 13 | Knowledge documents get `version`, `owner`, `approved_by`, `approved_at`, `updated_at`; statuses `under_review`, `disabled`; new `knowledge_retrievals` log | Knowledge Base screen, "AI Retrievals Today" |
| 14 | AI agents get `department`, `confidence_threshold`, `health`, `system_instructions`; new `agent_action_policies` | AI Agents screen, Agent Builder step 4 |
| 15 | Routing rules get `name`, `action`; `agent_id` optional; new `escalation_rules` (8 conditions) and `escalations.rule_id` | Routing & Escalation screen |
| 16 | Audit logs get `actor_type`, `result`, `risk_level`, `case_id`; new `security_events` | Audit Log, Settings → AI Safety & Security |
| 17 | New `platform_settings`, `sla_policies`, `notifications`; customers get `tier`; builder requests get `description` | Settings tabs, SLA timers, notification bell |
| 18 | Views `v_case_queue`, `v_dashboard_kpis`, `v_agent_performance`, `v_team_workload` (security_invoker) | Dashboard, Cases, AI Agents, Team Operations |
