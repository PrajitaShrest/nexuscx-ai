import Link from "next/link";
import type { Metadata } from "next";
import Logo from "@/components/Logo";
import TeamCredit from "@/components/TeamCredit";
import { BotIcon, GradCapIcon, HeadsetIcon, ShieldIcon, StoreIcon } from "@/components/Icons";

export const metadata: Metadata = { title: "About us" };

const IDEAS = [
  { icon: <BotIcon className="h-5 w-5" />, title: "AI answers first", text: "Specialist AI agents answer common questions in seconds, using only approved articles, and say who to contact." },
  { icon: <HeadsetIcon className="h-5 w-5" />, title: "People when it matters", text: "Wellbeing, visas, refunds, appeals and anything risky always go to a person, with a ready-made draft reply." },
  { icon: <ShieldIcon className="h-5 w-5" />, title: "Safe, and it can prove it", text: "Every rule is checked in the database, every step is logged, and a duty-of-care report shows sensitive cases reached a person." },
];
// Organisations already on the platform, each with its own agents, articles, staff and accounts
const PACKS = [
  { icon: <StoreIcon className="h-5 w-5" />, name: "NexusCX Store", kind: "E-commerce", text: "Orders, delivery, returns, billing and accounts." },
  { icon: <GradCapIcon className="h-5 w-5" />, name: "Northbridge University", kind: "University", text: "Admissions, fees, IT, exams and results, student services and international students." },
];
const STACK = ["Next.js", "React", "Tailwind CSS", "Supabase (PostgreSQL)", "Row Level Security", "Playwright", "GitHub Actions"];

// Public "About us" page: what NexusCX AI is, the team, and how it was built.
export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white text-ink">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <Link href="/" aria-label="NexusCX home"><Logo size={32} /></Link>
        <Link href="/login" className="text-sm font-semibold text-indigo-600 hover:underline">Sign in</Link>
      </header>

      <section className="bg-navy py-16 text-white">
        <div className="mx-auto max-w-4xl px-6">
          <p className="text-sm font-semibold text-indigo-300">About us</p>
          <h1 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">Smarter support. Human when it matters.</h1>
          <p className="mt-4 max-w-2xl text-slate-300">
            NexusCX AI is a duty-of-care AI support platform for organisations where a wrong answer can hurt someone.
            AI agents answer everyday questions, and real people step in for anything sensitive. One platform serves many
            organisations, each with its own industry pack. We built it as our PROF910 IT Project. It is a student project:
            NexusCX AI, NexusCX Store and Northbridge University are not real organisations.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-4xl space-y-14 px-6 py-14">
        <section aria-label="What NexusCX does" className="grid gap-4 sm:grid-cols-3">
          {IDEAS.map((i) => (
            <div key={i.title} className="rounded-2xl border border-slate-200 p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">{i.icon}</span>
              <h2 className="mt-3 font-semibold">{i.title}</h2>
              <p className="mt-1 text-sm text-muted">{i.text}</p>
            </div>
          ))}
        </section>

        <section aria-labelledby="packs">
          <h2 id="packs" className="text-xs font-semibold uppercase tracking-wider text-muted">One platform, two organisations (so far)</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {PACKS.map((p) => (
              <div key={p.name} className="flex gap-3 rounded-2xl border border-slate-200 p-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">{p.icon}</span>
                <div><p className="font-semibold">{p.name} <span className="text-xs font-normal text-muted">· {p.kind} pack</span></p><p className="mt-1 text-sm text-muted">{p.text}</p></div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-muted">Coming next: fast food, retail stores, internet and telco, banking and finance, hospitals.</p>
        </section>

        <TeamCredit size="large" />

        <section aria-labelledby="built-with">
          <h2 id="built-with" className="text-xs font-semibold uppercase tracking-wider text-muted">Built with</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {STACK.map((s) => <li key={s} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">{s}</li>)}
          </ul>
        </section>

        <p className="border-t pt-6 text-sm text-muted">
          <Link href="/terms" className="hover:underline">Terms</Link> · <Link href="/privacy" className="hover:underline">Privacy</Link> ·{" "}
          <a href="https://github.com/PrajitaShrest/nexuscx-ai" className="hover:underline">Source code on GitHub</a>
        </p>
      </main>
    </div>
  );
}
