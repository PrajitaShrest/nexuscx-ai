import Link from "next/link";
import Logo from "./Logo";
import TeamCredit from "./TeamCredit";
import { startDemo } from "@/app/pack-actions";
import {
  ArrowRightIcon, BellIcon, BookIcon, BotIcon, CheckIcon, ClockIcon, GlobeIcon, GradCapIcon, HeadsetIcon,
  HeartIcon, RepeatIcon, SearchIcon, ShieldIcon, SparkIcon, StoreIcon,
} from "./Icons";

// Public landing page (the site's front page for visitors who are not signed in).
// It explains what NexusCX AI does, why a business would use it, and opens the demos.

const STEPS = [
  { icon: <SearchIcon className="h-5 w-5" />, title: "Understands", text: "Reads the question in any language, works out the topic, the mood and the risk." },
  { icon: <BookIcon className="h-5 w-5" />, title: "Answers from approved facts", text: "Replies in seconds using only articles your team approved, and says who to contact." },
  { icon: <RepeatIcon className="h-5 w-5" />, title: "Does the job", text: "Simple tasks are done for the customer, like changing a size on a new order." },
  { icon: <HeadsetIcon className="h-5 w-5" />, title: "Hands over when it matters", text: "Wellbeing, visas, refunds and anything risky go straight to a person, with a draft reply ready." },
];

const FEATURES = [
  { icon: <HeartIcon className="h-5 w-5" />, title: "Duty-of-care report", text: "Proves every sensitive case reached a person, and how fast. Ready to print for managers or auditors." },
  { icon: <SparkIcon className="h-5 w-5" />, title: "Rule simulator", text: "Test a change to the escalation rules on last month's real questions before you switch it on." },
  { icon: <SearchIcon className="h-5 w-5" />, title: "Knowledge gaps", text: "Shows the questions the AI could not answer, grouped by topic, with a draft article to fill the gap." },
  { icon: <CheckIcon className="h-5 w-5" />, title: "Asks before escalating", text: "When unsure, the AI asks which topic you mean, instead of sending everything to staff." },
  { icon: <BotIcon className="h-5 w-5" />, title: "AI drafts for staff", text: "Staff get a summary, the reason it came to them and a suggested reply. They check, edit and send." },
  { icon: <ShieldIcon className="h-5 w-5" />, title: "Secure by design", text: "Rules are enforced in the database, each organisation's data is kept apart, and every step is logged." },
];

const WHY = [
  { value: "24/7", label: "Answers at any hour, in seconds" },
  { value: "Fewer", label: "Repeat questions reaching your staff" },
  { value: "Every", label: "Sensitive case passed to a person" },
  { value: "Every", label: "AI step written to the audit log" },
];

function DemoButton({ industry, label, primary }: { industry: "ecommerce" | "university"; label: string; primary?: boolean }) {
  return (
    <form action={startDemo}>
      <input type="hidden" name="industry" value={industry} />
      <button className={primary
        ? "inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-semibold text-indigo-700 shadow-lg shadow-indigo-900/30 hover:bg-indigo-50"
        : "inline-flex items-center gap-2 rounded-xl bg-white/10 px-5 py-3 font-semibold text-white ring-1 ring-white/30 hover:bg-white/20"}>
        {label} <ArrowRightIcon className="h-4 w-4" />
      </button>
    </form>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-white text-ink">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-navy/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" aria-label="NexusCX home"><Logo tone="light" size={32} /></Link>
          <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
            <a href="#how" className="hover:text-white">How it works</a>
            <a href="#features" className="hover:text-white">Features</a>
            <a href="#industries" className="hover:text-white">Industries</a>
            <a href="#team" className="hover:text-white">Team</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-white hover:bg-white/10">Sign in</Link>
            <a href="#demo" className="rounded-lg bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-400">Try the demo</a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-navy text-white">
        <div className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-indigo-600/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-20 h-[420px] w-[420px] rounded-full bg-fuchsia-600/20 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-indigo-200 ring-1 ring-white/15">
              <span className="h-2 w-2 rounded-full bg-emerald-400" /> AI customer support platform
            </p>
            <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              AI answers in seconds.<br /><span className="bg-gradient-to-r from-indigo-300 to-fuchsia-300 bg-clip-text text-transparent">People when it matters.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-slate-300">
              NexusCX AI handles everyday customer questions with a team of specialist AI agents, and hands anything sensitive
              to a real person. One platform for many kinds of organisation, from online stores to universities.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <DemoButton industry="ecommerce" label="Try the store demo" primary />
              <DemoButton industry="university" label="Try the university demo" />
            </div>
            <p className="mt-4 text-sm text-slate-400">Demo accounts are on the sign-in page. No payment, no real data.</p>
          </div>

          {/* Example conversation */}
          <div className="relative" aria-label="Example conversation">
            <div className="rounded-3xl bg-white p-5 text-ink shadow-2xl shadow-indigo-950/50">
              <div className="flex items-center gap-3 border-b pb-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white"><BotIcon className="h-5 w-5" /></span>
                <div><p className="text-sm font-semibold">Northbridge Student Assistant</p><p className="text-xs text-muted">Online · replies in seconds</p></div>
              </div>
              <div className="space-y-3 pt-4 text-sm">
                <p className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-gradient-to-br from-indigo-600 to-violet-600 px-3.5 py-2.5 text-white">Where do I get my student ID card?</p>
                <div className="max-w-[88%] rounded-2xl rounded-tl-md border border-slate-200 px-3.5 py-2.5">
                  Upload a photo in the Student Hub, then collect your card from the Student Centre (Building A, ground floor) with photo ID.
                  <p className="mt-2 text-xs text-muted">Who to contact: Student Centre (ID cards), idcards@northbridge.example</p>
                </div>
                <p className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-gradient-to-br from-indigo-600 to-violet-600 px-3.5 py-2.5 text-white">Honestly I&apos;m not coping this semester.</p>
                <div className="flex max-w-[92%] items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-amber-900">
                  <HeartIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Passed to the Student Wellbeing team as <strong>urgent</strong>. A person will contact you soon.</span>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-5 -left-4 hidden items-center gap-2 rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-ink shadow-xl sm:flex">
              <ShieldIcon className="h-4 w-4 text-emerald-600" /> Logged in the duty-of-care report
            </div>
          </div>
        </div>
      </section>

      {/* Why */}
      <section aria-label="Why NexusCX" className="border-b bg-slate-50">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-4 py-10 sm:px-6 lg:grid-cols-4">
          {WHY.map((w) => (
            <div key={w.label}>
              <p className="text-3xl font-bold text-indigo-700">{w.value}</p>
              <p className="mt-1 text-sm text-muted">{w.label}</p>
            </div>
          ))}
        </div>
      </section>

      <main>
        {/* Problem */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <p className="text-sm font-semibold text-indigo-600">The problem</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight">Support teams drown in the same questions, and the important ones wait.</h2>
            </div>
            <div className="space-y-4 text-muted">
              <p>Most messages are simple: where is my order, how do I reset my password, where do I get my ID card. Staff answer them again and again.</p>
              <p>Meanwhile the messages that really matter, like a student in distress or a customer charged twice, sit in the same queue.
                Most AI chatbots make this worse: they either guess at answers they shouldn&apos;t, or pass everything to a person.</p>
              <p className="font-medium text-ink">NexusCX AI answers the simple questions itself, and makes sure the important ones reach a person fast, with proof.</p>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-20 bg-slate-50 py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <p className="text-sm font-semibold text-indigo-600">How it works</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">Four steps, every message</h2>
            <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s, i) => (
                <li key={s.title} className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <span className="absolute right-4 top-4 text-sm font-bold text-slate-300">0{i + 1}</span>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">{s.icon}</span>
                  <h3 className="mt-3 font-semibold">{s.title}</h3>
                  <p className="mt-1 text-sm text-muted">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6">
          <p className="text-sm font-semibold text-indigo-600">What makes it different</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight">Built for organisations where a wrong answer can hurt someone</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl border border-slate-200 p-5 transition hover:-translate-y-0.5 hover:shadow-md">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white">{f.icon}</span>
                <h3 className="mt-3 font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Industries */}
        <section id="industries" className="scroll-mt-20 bg-navy py-16 text-white">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <p className="text-sm font-semibold text-indigo-300">One platform, many industries</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">Each organisation gets its own agents, articles, staff and rules</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/20 text-sky-300"><StoreIcon className="h-6 w-6" /></span>
                <h3 className="mt-4 text-xl font-semibold">Online stores</h3>
                <p className="mt-1 text-slate-300">Order tracking, returns, billing and accounts. The AI can even change a size or colour on a new order by itself.</p>
                <ul className="mt-4 space-y-1.5 text-sm text-slate-300">
                  {["Orders Agent, Billing Agent, Technical Support Agent", "Refunds always approved by a person", "Free exchanges handled in the portal"].map((t) => (
                    <li key={t} className="flex gap-2"><CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />{t}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-fuchsia-500/20 text-fuchsia-300"><GradCapIcon className="h-6 w-6" /></span>
                <h3 className="mt-4 text-xl font-semibold">Universities</h3>
                <p className="mt-1 text-slate-300">Admissions, fees, IT, exams and results, student services and international students.</p>
                <ul className="mt-4 space-y-1.5 text-sm text-slate-300">
                  {["Five department agents, with who-to-contact in every answer", "Wellbeing and visa questions always go to a person", "Duty-of-care report for student safety"].map((t) => (
                    <li key={t} className="flex gap-2"><CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />{t}</li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="mt-6 flex items-center gap-2 text-sm text-slate-400"><GlobeIcon className="h-4 w-4" /> Coming next: fast food, telco and internet, banking and finance, hospitals.</p>
          </div>
        </section>

        {/* For staff */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <p className="text-sm font-semibold text-indigo-600">For your team</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight">Less repeat work. More time for the people who need it.</h2>
              <ul className="mt-6 space-y-3 text-muted">
                {[
                  [<BellIcon key="b" className="h-5 w-5" />, "One inbox for everything that needs a person, sorted by urgency."],
                  [<ClockIcon key="c" className="h-5 w-5" />, "Response-time targets for each priority, with alerts before they are missed."],
                  [<BotIcon key="r" className="h-5 w-5" />, "A suggested reply on every case, written from the approved articles."],
                  [<SparkIcon key="s" className="h-5 w-5" />, "Live analytics: what customers ask, how the AI is doing, and where it needs help."],
                ].map(([icon, text], i) => (
                  <li key={i} className="flex gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">{icon}</span><span className="pt-1.5">{text}</span></li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Why it came to you</p>
              <div className="mt-3 rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">
                <p className="flex items-center justify-between text-sm"><span className="font-semibold">CX-10428 · Sarah Chen</span><span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Refund</span></p>
                <p className="mt-2 text-sm text-muted">&quot;I was charged twice for my subscription.&quot;</p>
                <p className="mt-3 rounded-xl bg-indigo-50 px-3 py-2 text-sm text-indigo-900"><strong>AI summary:</strong> duplicate charge confirmed in billing. Refunds need staff approval.</p>
                <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-sm"><strong>Suggested reply:</strong> Sorry about this, Sarah. I can see the second charge and have started your refund…</p>
              </div>
            </div>
          </div>
        </section>

        {/* Demo */}
        <section id="demo" className="scroll-mt-20 px-4 pb-16 sm:px-6">
          <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500 px-6 py-12 text-center text-white shadow-xl shadow-indigo-200 sm:px-12">
            <h2 className="text-3xl font-bold tracking-tight">See it for yourself</h2>
            <p className="mx-auto mt-3 max-w-xl text-indigo-100">Pick a demo, then sign in with one of the demo accounts listed on the sign-in page, as a customer, a student or a staff member.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <DemoButton industry="ecommerce" label="Store demo" primary />
              <DemoButton industry="university" label="University demo" />
            </div>
          </div>
        </section>

        {/* Team */}
        <section id="team" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-16 sm:px-6">
          <TeamCredit size="large" />
        </section>
      </main>

      <footer className="border-t bg-slate-50">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-muted sm:px-6">
          <p>NexusCX AI · PROF910 IT Project. A student project: NexusCX Store and Northbridge University are not real organisations.</p>
          <p className="flex gap-4">
            <Link href="/about" className="hover:text-ink">About us</Link>
            <Link href="/terms" className="hover:text-ink">Terms</Link>
            <Link href="/privacy" className="hover:text-ink">Privacy</Link>
            <a href="https://github.com/PrajitaShrest/nexuscx-ai" className="hover:text-ink">GitHub</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
