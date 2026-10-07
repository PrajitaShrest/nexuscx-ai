-- NexusCX AI - Migration 001: create core schema from the Week 4 ERD
-- Database: PostgreSQL 16 (Supabase)
-- Naming: snake_case, plural table names, UUID primary keys
-- Run first in Supabase SQL Editor (already run on 7 Oct 2026)

CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- provides gen_random_uuid()

-- 1. users: platform identities and roles
CREATE TABLE users (
    user_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL,
    email       VARCHAR(254) NOT NULL UNIQUE,
    role        VARCHAR(20)  NOT NULL
                CHECK (role IN ('customer','support_agent','team_leader','administrator')),
    status      VARCHAR(20)  NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','suspended','deleted')),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- 2. customers: profile linked 1:1 to a user
CREATE TABLE customers (
    customer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
    phone       VARCHAR(20),
    address     VARCHAR(255),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. cases: one support issue and its state
CREATE TABLE cases (
    case_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(customer_id) ON DELETE RESTRICT,
    status      VARCHAR(20) NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','in_progress','escalated','resolved','closed')),
    priority    VARCHAR(10) NOT NULL DEFAULT 'medium'
                CHECK (priority IN ('low','medium','high','urgent')),
    intent      VARCHAR(50),
    sentiment   VARCHAR(10) CHECK (sentiment IN ('positive','neutral','negative')),
    urgency     VARCHAR(10) CHECK (urgency IN ('low','medium','high')),
    risk        VARCHAR(10) CHECK (risk IN ('low','medium','high')),
    confidence  NUMERIC(4,3) CHECK (confidence BETWEEN 0 AND 1),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at   TIMESTAMPTZ,
    CHECK (closed_at IS NULL OR closed_at >= created_at)
);

-- 4. conversations: a communication session for a case
CREATE TABLE conversations (
    conversation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id     UUID NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
    channel     VARCHAR(20) NOT NULL DEFAULT 'web_chat'
                CHECK (channel IN ('web_chat','email','web_form')),
    started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at    TIMESTAMPTZ,
    CHECK (ended_at IS NULL OR ended_at >= started_at)
);

-- 5. messages: each customer, AI, system or human message
CREATE TABLE messages (
    message_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(conversation_id) ON DELETE CASCADE,
    sender_type     VARCHAR(20) NOT NULL
                    CHECK (sender_type IN ('customer','ai_agent','human_agent','system')),
    sender_id       UUID,          -- user_id or agent_id depending on sender_type (polymorphic, no FK)
    content         TEXT NOT NULL CHECK (length(content) > 0),
    message_type    VARCHAR(20) NOT NULL DEFAULT 'text'
                    CHECK (message_type IN ('text','attachment','system_notice')),
    sent_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. ai_agents: specialist AI agents available to the orchestrator
CREATE TABLE ai_agents (
    agent_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL UNIQUE,
    type        VARCHAR(30)  NOT NULL
                CHECK (type IN ('orchestrator','classifier','specialist','safety')),
    description TEXT,
    model_name  VARCHAR(100) NOT NULL,
    status      VARCHAR(20)  NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','testing','active','retired'))
);

-- 7. classifications: AI classification results for a case
CREATE TABLE classifications (
    classification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id     UUID NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
    agent_id    UUID NOT NULL REFERENCES ai_agents(agent_id) ON DELETE RESTRICT,
    intent      VARCHAR(50) NOT NULL,
    sentiment   VARCHAR(10) CHECK (sentiment IN ('positive','neutral','negative')),
    urgency     VARCHAR(10) CHECK (urgency IN ('low','medium','high')),
    risk        VARCHAR(10) CHECK (risk IN ('low','medium','high')),
    language    VARCHAR(10) NOT NULL DEFAULT 'en',
    confidence  NUMERIC(4,3) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. escalations: why and where a case was escalated
CREATE TABLE escalations (
    escalation_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id        UUID NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
    reason         VARCHAR(255) NOT NULL,
    escalated_from VARCHAR(50) NOT NULL,   -- e.g. 'billing_agent'
    escalated_to   VARCHAR(50) NOT NULL,   -- e.g. 'human_support_queue'
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    status         VARCHAR(20) NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','accepted','resolved'))
);

-- 9. case_assignments: a case assigned to a human user
CREATE TABLE case_assignments (
    assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id     UUID NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status      VARCHAR(20) NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','completed','reassigned'))
);

-- 10. feedback: at most one rating per case (ERD 1 : 0..1)
CREATE TABLE feedback (
    feedback_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id     UUID NOT NULL UNIQUE REFERENCES cases(case_id) ON DELETE CASCADE,
    rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment     TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. audit_logs: important human and AI actions (user_id optional for AI/system actions)
CREATE TABLE audit_logs (
    log_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(user_id) ON DELETE SET NULL,
    actor       VARCHAR(50) NOT NULL,      -- e.g. 'support_agent', 'billing_agent', 'system'
    action      VARCHAR(50) NOT NULL,      -- e.g. 'case_escalated'
    entity_type VARCHAR(50) NOT NULL,      -- e.g. 'cases'
    entity_id   UUID,
    details     JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. knowledge_documents: approved policies, FAQs and procedures
CREATE TABLE knowledge_documents (
    document_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       VARCHAR(200) NOT NULL,
    category    VARCHAR(50)  NOT NULL,
    content     TEXT NOT NULL,
    status      VARCHAR(20)  NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','approved','archived')),
    source      VARCHAR(255),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. agent_builder_requests: business request to create a new specialist agent
CREATE TABLE agent_builder_requests (
    request_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    agent_name    VARCHAR(100) NOT NULL,
    department    VARCHAR(50)  NOT NULL,
    business_goal TEXT NOT NULL,
    requirements  TEXT,
    status        VARCHAR(20) NOT NULL DEFAULT 'submitted'
                  CHECK (status IN ('submitted','drafted','in_review','approved','rejected')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 14. agent_config_versions: generated and reviewed versions of agent configuration
CREATE TABLE agent_config_versions (
    config_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id         UUID REFERENCES agent_builder_requests(request_id) ON DELETE SET NULL,
    agent_id           UUID REFERENCES ai_agents(agent_id) ON DELETE SET NULL,  -- null until activated
    created_by_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    config_data        JSONB NOT NULL,
    version            INTEGER NOT NULL CHECK (version >= 1),
    status             VARCHAR(20) NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft','testing','approved','rejected','superseded')),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (request_id, version)
);

-- 15. agent_tests: test scenarios and results for a proposed agent
CREATE TABLE agent_tests (
    test_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id        UUID NOT NULL REFERENCES agent_config_versions(config_id) ON DELETE CASCADE,
    scenario_prompt  TEXT NOT NULL,
    expected_outcome TEXT NOT NULL,
    actual_result    TEXT,
    passed           BOOLEAN,
    tested_at        TIMESTAMPTZ
);

-- 16. agent_knowledge_sources: junction (many-to-many) config <-> document
CREATE TABLE agent_knowledge_sources (
    config_id   UUID NOT NULL REFERENCES agent_config_versions(config_id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES knowledge_documents(document_id) ON DELETE CASCADE,
    PRIMARY KEY (config_id, document_id)
);

-- 17. routing_rules: intent/condition rules that route cases to specialist agents
CREATE TABLE routing_rules (
    rule_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id   UUID NOT NULL REFERENCES ai_agents(agent_id) ON DELETE CASCADE,
    intent     VARCHAR(50) NOT NULL,
    condition  JSONB,                      -- e.g. {"max_risk": "medium", "min_confidence": 0.6}
    priority   SMALLINT NOT NULL DEFAULT 100 CHECK (priority > 0),
    status     VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes on foreign keys and common filters
CREATE INDEX idx_cases_customer       ON cases(customer_id);
CREATE INDEX idx_cases_status         ON cases(status);
CREATE INDEX idx_conversations_case   ON conversations(case_id);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, sent_at);
CREATE INDEX idx_classifications_case ON classifications(case_id);
CREATE INDEX idx_escalations_case     ON escalations(case_id);
CREATE INDEX idx_assignments_case     ON case_assignments(case_id);
CREATE INDEX idx_assignments_user     ON case_assignments(user_id);
CREATE INDEX idx_audit_entity         ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_routing_intent       ON routing_rules(intent) WHERE status = 'active';
