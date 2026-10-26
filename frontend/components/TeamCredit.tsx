import Link from "next/link";

// "Meet the team": one card per person with their role.
// Small version on the sign-in pages, large version on the About us page.
// Names and roles only (no IDs or contact details), because the site is public.
// To change a role or description, edit the TEAM list below.
// Simple line icons for each role (24×24, drawn with the current text colour).
const ICONS: Record<string, React.ReactNode> = {
  code: <><path d="m8 8-4 4 4 4" /><path d="m16 8 4 4-4 4" /><path d="m13.5 5-3 14" /></>,
  check: <><path d="M12 3 5 6v5c0 4.4 3 8.3 7 9.5 4-1.2 7-5.1 7-9.5V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></>,
  database: <><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" /><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></>,
};

// A role tile: soft gradient, a role icon and a small initials tag in the corner.
function Portrait({ p, big }: { p: (typeof TEAM)[number]; big?: boolean }) {
  return (
    <span aria-hidden="true" className={`relative flex shrink-0 items-center justify-center bg-gradient-to-br ${p.tone} text-white shadow-sm ${big ? "h-16 w-16 rounded-2xl" : "h-9 w-9 rounded-xl"}`}>
      <span className="absolute inset-0 rounded-[inherit] bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.45),transparent_55%)]" />
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={big ? 1.8 : 2} strokeLinecap="round" strokeLinejoin="round" className={`relative ${big ? "h-8 w-8" : "h-[18px] w-[18px]"}`}>
        {ICONS[p.icon]}
      </svg>
      <span className={`absolute rounded-md bg-white font-bold text-slate-800 shadow ring-1 ring-black/5 ${big ? "-bottom-1.5 -right-1.5 px-1.5 py-0.5 text-[10px]" : "-bottom-1 -right-1 px-1 text-[8px] leading-[14px]"}`}>{p.initials}</span>
    </span>
  );
}

const TEAM = [
  { name: "Bishal Bastakoti", role: "Frontend & UX", initials: "BB", icon: "code", tone: "from-sky-400 to-indigo-500",
    about: "Designs the screens and builds the customer and staff pages." },
  { name: "Hari Ranabhat", role: "Testing & Quality", initials: "HR", icon: "check", tone: "from-emerald-400 to-teal-500",
    about: "Plans and runs the tests and checks every release before it ships." },
  { name: "Prajita Shrestha", role: "Database & Backend Lead", initials: "PS", icon: "database", tone: "from-fuchsia-400 to-violet-500",
    about: "Designs the database, the security rules and how the AI routes each case." },
];

export default function TeamCredit({ tone = "dark", size = "small" }: { tone?: "dark" | "light"; size?: "small" | "large" }) {
  if (size === "large") {
    return (
      <section aria-labelledby="team-title">
        <h2 id="team-title" className="text-2xl font-bold">Meet the team</h2>
        <p className="mt-1 text-muted">Three Master of IT students who designed, built and tested NexusCX AI.</p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-3">
          {TEAM.map((p) => (
            <li key={p.name} className="rounded-2xl border border-slate-200 p-5 transition hover:border-indigo-200 hover:shadow-sm">
              <Portrait p={p} big />
              <p className="mt-4 text-lg font-semibold leading-tight">{p.name}</p>
              <p className="mt-0.5 text-sm font-medium text-indigo-600">{p.role}</p>
              <p className="mt-2 text-sm text-muted">{p.about}</p>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  const light = tone === "light";
  return (
    <section aria-labelledby="team-title">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h2 id="team-title" className={`whitespace-nowrap text-xs font-semibold uppercase tracking-wider ${light ? "text-slate-400" : "text-muted"}`}>Meet the team</h2>
        <Link href="/about" className={`text-[11px] hover:underline ${light ? "text-slate-400" : "text-indigo-600"}`}>About us →</Link>
      </div>
      <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {TEAM.map((p) => (
          <li key={p.name}
            className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 sm:flex-col sm:items-start sm:gap-2 ${light ? "bg-white/[0.06] ring-1 ring-white/10" : "bg-slate-50 ring-1 ring-slate-200"}`}>
            <Portrait p={p} />
            <span className="min-w-0">
              <span className={`block text-sm font-semibold leading-tight ${light ? "text-white" : "text-ink"}`}>{p.name}</span>
              <span className={`block text-xs ${light ? "text-slate-400" : "text-muted"}`}>{p.role}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className={`mt-2 text-[11px] ${light ? "text-slate-500" : "text-muted"}`}>PROF910 student project · not a real company</p>
    </section>
  );
}
