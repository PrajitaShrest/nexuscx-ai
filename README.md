# NexusCX AI

A multi-agent customer service platform. Customers ask for help in a chat. AI agents classify each message, route it to the right specialist agent, answer only from approved help articles, and pass anything risky or unclear to a human. Staff work the queue, and administrators control who can do what.

PROF910 IT Project Part B – group project.

| Team member | Main area |
|---|---|
| Prajita Shrestha | Database, authentication, security |
| Bishal Bastakoti | *(add your area)* |
| Hari Ranabhat | *(add your area)* |

---

## Technology stack

| Part | Technology |
|---|---|
| Frontend and backend | Next.js 16 (App Router, server actions), React 19, TypeScript |
| Styling | Tailwind CSS 4, Figtree font |
| Database | Supabase (PostgreSQL) with Row Level Security on every table |
| Sign-in | Supabase Auth (passwords stored as bcrypt hashes) |
| Hosting of code | GitHub |

## Project folders

```
database/   SQL files, run in order (see "Set up the database")
docs/       schema-changes.md: every change from the Week 4 ERD
frontend/   the Next.js app
  app/          pages and server actions
  components/   shared UI (Sidebar, UserMenu, Avatar, Icons, ...)
  lib/          Supabase clients, data access, password and phone helpers
  proxy.ts      sends signed-out users to the sign-in page
```

---

## Set up on a new computer

### 1. What you need

- Node.js 20 or newer (`node -v`)
- Git
- A Supabase account (free plan is fine)

### 2. Get the code

```bash
git clone https://github.com/PrajitaShrest/nexuscx-ai.git
cd nexuscx-ai/frontend
npm install
```

### 3. Set up the database

In Supabase, create a new project. Then open **SQL Editor → New query** and run each file from `database/` **in this order**, one at a time (paste the whole file, click **Run**):

| Order | File | What it does |
|---|---|---|
| 1 | `001_create_schema.sql` | Core tables, keys and rules |
| 2 | `002_seed_data.sql` | Sample customers, staff, cases and help articles |
| – | `003_crud_tests.sql` | Optional. Create/read/update/delete tests. Run a test at a time. |
| 3 | `004_prototype_alignment.sql` | Brings the database in line with the Figma prototype (27 tables, views) |
| 4 | `005_auth_and_security.sql` | Links Supabase Auth to users, Row Level Security, the core `submit_enquiry` function |
| 5 | `006_username_and_dob.sql` | Usernames and date of birth (minimum age 10) |
| 6 | `007_login_security.sql` | Lock after 5 wrong passwords, phone and terms at sign-up |
| 7 | `008_admin_controls.sql` | Administrator tools: extra roles, suspend, unlock, temporary password, delete |
| 8 | `009_smarter_answers.sql` | 20+ approved help articles and full-text search for answers |

Each file ends with a small check query. A table of results means it worked.

### 4. Supabase settings

In the Supabase dashboard:

1. **Authentication → Sign In / Providers → Email**: turn **on**.
2. Same page, **User Signups → Confirm email**: turn **off** (the free plan can only send a few emails per hour).
3. **Authentication → URL Configuration**: Site URL `http://localhost:3000`, Redirect URL `http://localhost:3000/**` (needed for "Forgot password").

### 5. Environment file

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in the two values from **Supabase → Connect** (or **Project Settings → API**):

| Name | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key (starts with `sb_publishable_`) |

Never put the **secret** key or the database password in this file or in GitHub. `.env.local` is ignored by Git.

### 6. Start the app

```bash
npm run dev
```

Open http://localhost:3000. If port 3000 is busy: `lsof -ti:3000 | xargs kill`, then try again.

---

## Demonstration accounts

Customers can register at `/signup`. Staff accounts are made by an administrator in Supabase:

1. **Authentication → Users → Add user → Create new user**.
2. Use one of the seeded staff emails below, choose a password, tick **Auto Confirm User**.
3. The new login links itself to the existing staff record (same email), so the person keeps their role and team.

| Role | Username | Email |
|---|---|---|
| Customer | `alex.nguyen` | alex.nguyen@example.test |
| Support Agent | `riley.support` | riley.support@example.test |
| Team Leader | `jamie.lead` | jamie.lead@example.test |
| Knowledge Manager | `taylor.kim` | taylor.kim@example.test |
| Business Specialist | `drew.singh` | drew.singh@example.test |
| Administrator | `avery.admin` | avery.admin@example.test |

Passwords are not stored in this repository. Ask the team.

Customers sign in at `/login`. Staff sign in at `/staff/login` (choose your role from the list).

---

## What works now (Week 6)

**Sign-up and sign-in**
- Register with full name, username (checked live), email, Australian mobile (optional), date of birth (under 10 refused), password with strength meter and confirm box, Terms & Privacy tick.
- Sign in with username **or** email; show/hide password; Caps Lock warning; "Remember me".
- 5 wrong passwords in 15 minutes locks the account for 15 minutes (emails stored only as a hash in the attempts table).
- Forgot password by email link; separate staff sign-in page; log out.
- Private pages redirect to sign-in; `/api/cases` returns 401 when signed out.

**Customer Help Centre (`/support`) – the core feature**
- Chat with the AI assistant, topic cards with starter questions, "Talk to a person" button.
- Each message: classified (topic, mood, urgency, risk, confidence) → routed to the Orders, Billing or Technical agent → answered **only** from an approved help article (with the source shown) → or escalated to a person by the escalation rules (refunds, high risk, angry, urgent, prompt injection, low confidence, no approved answer, customer asks for a human).
- Progress steps and "How our AI understood this" on every reply; My requests list with Open/Resolved tabs.
- Everything is saved in one database transaction with an audit log entry.

**Staff workspace**
- Conversations and Cases queues (live from the database).
- Menu items appear only if the person's roles allow them; pages and the database check again (403 page if not allowed).
- Account menu with availability (Online / Busy / Away).

**Administrator ("IT") tools – Users & Roles**
- Search and filter people; edit name and team.
- One main role plus up to 2 extra roles (permissions are combined).
- Suspend / reactivate, unlock sign-in, email a reset link, set a temporary password (must be changed at next sign-in), delete (keeps case history but removes personal details).
- Permission table: tick or untick each permission per role.
- Safety rules: you can't suspend, delete or demote yourself; at least one administrator always remains; every action goes to the audit log.

**Profile (`/profile`)**
- Edit name, username, and (customers) mobile, date of birth and address; profile strength meter; change password (current password required); "What you can do" for staff. Saving returns to your home page with a confirmation message.

## Security summary

- Passwords are hashed by Supabase Auth (bcrypt). The app never sees or stores them.
- Row Level Security is on for every table. Customers see only their own cases; staff access depends on permissions.
- Admin actions run in `SECURITY DEFINER` database functions that check the caller's permission first.
- All input is validated in the app **and** again in the database.
- Secrets live only in `.env.local`, which Git ignores.

## Known issues and next steps

| Issue | Plan |
|---|---|
| The AI classification is rule-based (keywords), not a language model. | Week 7: connect an LLM behind the same `submit_enquiry` steps. |
| Help articles in `009` are sample policies for a demo store. | Replace with the client's real, approved content. |
| Dashboard, Customers, Knowledge Base, AI Agents, Routing, Analytics, Team Operations, Audit Logs and Settings show as "Wk 7–9" in the menu. | Built in Weeks 7–9. |
| `login_email()` lets anyone who knows a username look up its email (needed for username sign-in). | Accepted for the project; production would do this lookup on the server with a private key. |
| Supabase free plan limits emails (reset links). | Use "Set temporary password" in Users & Roles during demos. |
| `frontend/lib/db.ts` and the `pg` package are no longer used. | Remove in Week 7 clean-up. |
| Smoke test (14 checks) still to be recorded. | Before the Week 6 demo. |
