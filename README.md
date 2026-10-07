# NexusCX AI – Database (Supabase / PostgreSQL)

Owner: Prajita Shrestha

## Set up (about 3 minutes)

1. Open your Supabase project → **SQL Editor** → **New query**.
2. Paste all of `001_create_tables.sql` → click **Run**. (Creates 9 tables, keys, rules and security.)
3. New query → paste all of `002_seed_data.sql` → **Run**. (Adds fake sample data.)
4. Optional: open `003_crud_tests.sql`. Highlight one test at a time → **Run**.
5. Check **Table Editor**: you should see 9 tables. `cases` has 7 rows.

## Reset the data

Run `001` then `002` again. Script `001` drops and rebuilds the 9 tables.

## Files

| File | What it does |
|---|---|
| `001_create_tables.sql` | 9 core tables, primary/foreign keys, CHECK rules, indexes, Row Level Security |
| `002_seed_data.sql` | Fake data matching the Figma prototype (7 cases, 11 users, 4 AI agents, 7 knowledge documents) |
| `003_crud_tests.sql` | Create, read, update, delete and constraint tests |
| `mysql/` | Earlier local MySQL version (superseded, kept for the record) |

## Tables built (9 of 17 in the ERD)

users, customers, ai_agents, knowledge_documents, cases, conversations, messages, classifications, escalations.

Every difference from the Week 4 ERD is listed in `/docs/schema-changes.md`.
