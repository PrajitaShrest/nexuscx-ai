# NexusCX AI

A multi-agent customer service platform. Customers ask for help in a chat. AI agents classify each message, route it to the right specialist agent, answer only from approved help articles, and pass anything risky or unclear to a human. Staff work the queue, and administrators control who can do what.

PROF910 IT Project Part B – group project.

**Live site:** https://nexuscx-ai.vercel.app

| Team member | Main area |
|---|---|
| Prajita Shrestha | Database & backend lead: database, authentication, security |
| Bishal Bastakoti | Frontend & UX |
| Hari Ranabhat | Testing & quality |

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
| 9 | `010_customer_portal.sql` | Shop, addresses, orders and order history |
| 10 | `011_case_workflow_and_returns.sql` | Staff case workspace, returns and exchanges, notifications |
| 11 | `012_knowledge_and_customers.sql` | Knowledge Base editing with review, Customers list |
| 12 | `013_customers_only.sql` | Customers list shows customers only |
| 13 | `014_dashboard_stats.sql` | Dashboard charts and filters |
| 14 | `015_admin_screens.sql` | AI Agents, Routing & Escalation, Settings, Analytics, Team Operations |
| 15 | `016_rate_limits_and_photos.sql` | Message limits, private return photos, live chat updates |
| 16 | `017_university_pack.sql` | Industry packs: the E-commerce / University switch, 5 university agents, 25 university articles, language detection, wellbeing and visa safety rules |
| 17 | `018_visitor_industry.sql` | Each visitor can choose the E-commerce or University demo in their own browser |
| 18 | `019_duty_of_care.sql` | Duty-of-care features: rule simulator, knowledge gaps, duty-of-care report; off-topic questions go to a person instead of a wrong article |
| 19 | `020_less_work_for_staff.sql` | Ask before escalating (topic buttons), "Did this help?" 👍/👎, AI-drafted replies for staff |
| 20 | `021_separate_organisations.sql` | Each account belongs to one organisation (store or Northbridge); Northbridge demo students and staff |
| 21 | `022_better_answers.sql` | Who-to-contact line on every answer (departments table), 17 more specific Northbridge articles, confidence that reflects how well the article matches |
| 22 | `023_university_staff.sql` | Northbridge staff job titles and teams (lecturer, librarian, reception, IT, admissions & finance); Team Operations shows each organisation's own staff |
| 23 | `024_student_wording.sql` | Inbox items and new audit entries for university cases say "student" instead of "customer" |
| 24 | `025_ai_order_changes.sql` | The Orders Agent changes a size or colour itself: checks order number + delivery postcode, ordered in the last 2 days, not shipped; logs it and closes the case. Re-run to refresh the demo order |
| 25 | `026_service_requests.sql` | Forms and service requests: the AI offers a pre-filled, checked form (student ID card with photo, enrolment letter, transcript, parking permit, store delivery address change); staff queue, mark ready, person notified; digital card, letter and permit |
| 26 | `027_ai_follow_ups.sql` | The AI also answers follow-up messages in an existing chat (a person only when needed); privacy and policy answers; wellbeing check recognises "not coping", "hopeless" and similar |
| 27 | `028_credit_checker.sql` | AI credit checker: students add (or paste) previous units; credit rules approve recognised units instantly (precedents, same content, passed, last 10 years, up to half a course); only unclear units go to an academic assessor |
| 28 | `029_instant_letters.sql` | Digital enrolment letters are issued instantly from the student record (no staff click); printed copies still go to the Student Centre |
| 29 | `030_batch1.sql` | Holiday letter and course completion letter (instant, by the university's rules); product safety reports in the online store are a hard stop (urgent, to a person) and counted in the duty-of-care report; follow-up messages that go to a person now count as escalations |
| 30 | `031_batch2.sql` | Talk to a person: urgent call-backs (wellbeing and product safety never have to book), call back today, or book a time with a team; staff Bookings page; special consideration form (a person always decides) |
| 31 | `032_safe_limits.sql` | Spam guard never blocks a wellbeing or product-safety message; 10 new chats per 10 minutes (was 5) |

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
| `NEXT_PUBLIC_SITE_URL` | Online only: the app's public address, e.g. `https://nexuscx-ai.vercel.app`. Leave empty locally. |

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

Northbridge University (University pack) demo people:

| Role | Username | Email |
|---|---|---|
| Student | `priya.sharma` | priya.sharma@example.test |
| Student Services Officer (Student Services) | `ella.martin` | ella.martin@example.test |
| Senior Lecturer & Academic Adviser (Academic Services) | `chris.wong` | chris.wong@example.test |
| Librarian (Library) | `grace.kim` | grace.kim@example.test |
| Student Centre Receptionist (Student Centre) | `tom.nguyen` | tom.nguyen@example.test |
| IT Service Desk Officer (IT Service Desk) | `raj.mehta` | raj.mehta@example.test |
| Admissions & Finance Officer (Admissions & Finance) | `lucy.park` | lucy.park@example.test |

Each account belongs to **one** organisation: store customers and staff only ever see the store, and Northbridge students and staff only ever see the university (enforced in the database). Only the platform team (administrators, knowledge managers, business specialists) can switch between packs, which is how both are shown in a demo. New sign-ups belong to the demo chosen on the sign-up page.

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

## Industry packs (E-commerce and University)

NexusCX is one platform that can be set up for different kinds of business. Each **industry pack** has its own AI agents, knowledge base, routing rules, cases and wording. Anyone can choose **E-commerce** or **University** with the switch on the sign-in page and in the menu. The choice is saved in their own browser only, so other people are not affected. An administrator sets the **default** pack in **Settings → Default industry pack** (saved in the audit log).

| Pack | Organisation | Departments / agents |
|---|---|---|
| E-commerce | NexusCX Store | Orders, Billing, Technical Support |
| University | Northbridge University (made up for the demo) | Admissions, Finance, IT Support, Academic (incl. exams and results), Student Services (incl. ID cards, international students and visa information) |

University flow: student message → Orchestrator → classify intent, **language**, sentiment, urgency and risk → department agent → that department's approved articles → answer with the source → policy, confidence and risk check → answer the student, or create a ticket for a person → staff resolve → feedback → analytics.

Safety rules in the University pack:
- Wellbeing messages (for example "I can't cope") always go to a person as **urgent**, and the student sees 000 and Lifeline 13 11 14.
- Personal visa questions always go to a person. The AI only gives general information and points to homeaffairs.gov.au.
- Special consideration, academic integrity, grade appeals, refunds and hardship are decided by staff.
- Messages in other languages (for example Nepali, Hindi or Chinese) are passed to a person.

### Duty-of-care features (what makes NexusCX different)

- **Test before you switch** (`/simulator`): replay real questions from the last 7, 30 or 90 days with a proposed confidence threshold, escalation switches or a paused agent, and see what would change before saving. Hard stops (wellbeing, personal visa) are never affected.
- **Knowledge gaps** (`/knowledge/gaps`): questions the AI could not answer, grouped by topic, with a "Draft an article" button. Drafts still need a second person to approve them; once approved, those questions drop off the list.
- **Duty-of-care report** (`/duty-of-care`): proof that every sensitive case went to a person, how fast staff picked them up, and how many steps were recorded. Print or save as PDF, or download a CSV.

### Fewer cases for people, faster when they come

Hard stops always go to a person. For everything else the AI tries harder first:
- **Ask before escalating**: when the AI is unsure it offers up to 3 likely topics as buttons ("None of these" still reaches a person).
- **Did this help?**: 👍 closes the request; 👎 passes it to the right team. Articles that did not help are listed on Knowledge gaps.
- **AI-drafted replies**: on a case with a person, staff see a summary, why it came to them, and a suggested reply ("Use AI draft"). Staff decide what is sent.

Next step (not built yet): share new cases automatically with the least busy person in the right team.

Coming next: fast food, retail stores, internet and telco, banking and finance, hospitals.

## Deploy to Vercel

The app is live at **https://nexuscx-ai.vercel.app** (Vercel project `nexuscx-ai-qqp6`, root directory `frontend`, deployed 27 October 2026). Every push to `main` redeploys it. The steps below are for setting it up again.

1. Merge everything into `main` with green checks.
2. On [vercel.com](https://vercel.com), sign in with GitHub → **Add New → Project** → import `nexuscx-ai`.
3. Set **Root Directory** to `frontend`. Framework is detected as Next.js.
4. Add **Environment Variables** (names only are listed in `frontend/.env.example`):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and after the first deploy `NEXT_PUBLIC_SITE_URL` (the Vercel address).
   Optional for the class demo: `NEXT_PUBLIC_SHOW_DEMO_LOGINS=1`. Never add the secret key or database password.
5. Click **Deploy**.
6. In Supabase → **Authentication → URL Configuration**: set **Site URL** to the Vercel address and add `https://<your-app>.vercel.app/**` to **Redirect URLs** (keep `http://localhost:3000/**` for development).
7. Redeploy once so `NEXT_PUBLIC_SITE_URL` is used, then sign in on the live site with each demo role.

## Security summary

- Passwords are hashed by Supabase Auth (bcrypt). The app never sees or stores them.
- Row Level Security is on for every table. Customers see only their own cases; staff access depends on permissions.
- Admin actions run in `SECURITY DEFINER` database functions that check the caller's permission first.
- All input is validated in the app **and** again in the database.
- Secrets live only in `.env.local`, which Git ignores. Only the publishable key is used online.
- Customers are limited to 5 new requests per 10 minutes and 10 chat messages per minute (database rules).
- Return photos are in a private Storage bucket; only the customer and staff can open them, through 1-hour links.
- The live site sends security headers (no framing, no MIME sniffing, HTTPS only) and hides demo usernames unless switched on.

## Known issues and next steps

| Issue | Plan |
|---|---|
| The AI classification is rule-based (keywords), not a language model. Agent "Instructions" are stored but not read yet. | Connect an LLM behind the same `submit_enquiry` steps. |
| Help articles in `009` are sample policies for a demo store. | Replace with the client's real, approved content. |
| Notification switches and integration status in Settings are saved but no email/Slack alerts are sent yet. | Add email alerts after the core build. |
| `login_email()` lets anyone who knows a username look up its email (needed for username sign-in). | Accepted for the project; production would do this lookup on the server with a private key. |
| Supabase free plan limits emails (reset links). | Use "Set temporary password" in Users & Roles during demos. |
| Free Supabase projects pause after a week without use. | Open the dashboard the day before any demo. |
