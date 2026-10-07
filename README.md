# NexusCX AI – Multi-Agent Customer Service Platform

PROF910 IT Project Part B · Skyline Higher Education Australia

NexusCX AI answers routine customer enquiries with specialist AI agents. It grounds answers in approved company knowledge and escalates risky or uncertain cases to human staff.

## Team

| Member | Main area |
|---|---|
| Bishal Bastakoti | _to fill in_ |
| Hari Ranabhat | _to fill in_ |
| Prajita Shrestha | Database (Supabase / PostgreSQL) |

## Technology stack

| Layer | Choice |
|---|---|
| Frontend | React 18 + Vite, React Router |
| Backend / API | Supabase (auto REST API, Auth, Edge Functions) |
| Database | PostgreSQL on Supabase |
| AI | AI API called from a Supabase Edge Function (Week 6) |
| Hosting | Vercel (frontend), Supabase (backend) |
| Dev tools | Figma (design), GitHub (code), Cursor / Claude (AI coding help – see AI disclosure) |

## Project structure

```
/frontend   React app (screens from the Figma prototype)
/database   SQL scripts: tables, seed data, tests
/docs       Schema changes, architecture, decisions
```

## Getting started

Prerequisites: Node.js 20+, Git, a Supabase project.

```bash
# 1. Get the code
git clone <repository-url>
cd nexuscx-ai

# 2. Set up the database (once per Supabase project)
#    Follow database/README.md (paste 001 then 002 into the Supabase SQL Editor)

# 3. Configure the frontend
cd frontend
cp .env.example .env        # then paste your Supabase URL and anon/publishable key

# 4. Install and run
npm install
npm run dev                 # opens at http://localhost:5173
```

Click **Support Agent** on the login page. The **Cases** page shows the 7 seeded cases live from Supabase.

## Week 5 status

- ✅ Working: Cases page reads real data (frontend → Supabase API → PostgreSQL)
- ⏳ Placeholder: login, all other pages (routing is real, content comes in later sprints)

## Branch and commit rules

- `main` always works. Nobody commits directly to `main`.
- One branch per backlog item: `feature/<short-name>`, e.g. `feature/case-detail`.
- Merge through a pull request, reviewed by one other member.
- Commit messages start with `feat:`, `fix:`, `docs:` or `test:`.
- Push at the end of every working session.
- Never commit `.env`, keys or real personal data.
