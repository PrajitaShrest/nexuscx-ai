import Logo from "./Logo";
import TeamCredit from "./TeamCredit";
import PackSwitch from "./PackSwitch";
import type { Industry } from "@/lib/packs";

// Sign-in and sign-up frame. Left: what NexusCX does, shown as one real
// conversation being classified and routed. Right: the form.
// The staff variant swaps the story for what staff do with that conversation.
// The example conversation on the left follows the chosen demo pack
const STORY = {
  ecommerce: {
    ask: "I was charged twice for my subscription this month.",
    tags: ["Billing", "Risk: high", "96% confident"], flag: "Refund needs a person",
    reply: "Refunds are approved by our billing team, so I've passed this to a specialist. They'll reply in about 2 minutes.",
    source: "Source: Refund Policy v4.2",
  },
  university: {
    ask: "Can I work more hours on my student visa this semester?",
    tags: ["Student Services", "Language: English", "92% confident"], flag: "Personal visa question needs a person",
    reply: "I can share general visa information only, so I've passed this to our International Student Advisers. The official rules are on homeaffairs.gov.au.",
    source: "Source: Student visa conditions v1.0",
  },
};

export default function AuthCard({ title, subtitle, children, variant = "customer", industry }: {
  title: string; subtitle: string; children: React.ReactNode; variant?: "customer" | "staff";
  industry?: Industry; // given on the sign-in pages: shows the "Choose a demo" switch
}) {
  const staff = variant === "staff";
  const story = STORY[industry ?? "ecommerce"];
  return (
    <div className="flex min-h-screen bg-white">
      <aside className={`hidden w-[46%] flex-col justify-between p-12 text-white lg:sticky lg:top-0 lg:flex lg:h-screen ${staff ? "bg-[#0a1326]" : "bg-navy"}`}>
        <div className="flex items-center justify-between">
          <Logo tone="light" />
          {staff && <span className="rounded-full border border-amber-300/40 px-3 py-1 text-xs font-medium text-amber-200">Staff portal</span>}
        </div>

        {staff ? (
          <div className="max-w-md">
            <h1 className="text-[2.6rem] font-bold leading-[1.1] tracking-tight">Pick up where the AI stops.</h1>
            <div className="mt-10 space-y-3" aria-hidden="true">
              <div className="rise rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span><span className="font-semibold">Sarah Chen</span> <span className="ml-1 text-slate-400">CX-10428</span></span>
                  <span className="rounded-full bg-red-500/20 px-2.5 py-0.5 text-xs text-red-200">Escalated</span>
                </div>
                <p className="mt-2 text-slate-300">Duplicate subscription payment. Refund requested.</p>
                <p className="mt-3 text-xs text-slate-400">Why it came to you: refunds need staff approval</p>
              </div>
              <div className="rise rise-2 flex gap-2 text-xs">
                <span className="rounded-full bg-white/10 px-3 py-1">Take over</span>
                <span className="rounded-full bg-white/10 px-3 py-1">Reply</span>
                <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-emerald-200">Resolve</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-md">
            <h1 className="text-[2.6rem] font-bold leading-[1.1] tracking-tight">Smarter support. Human when it matters.</h1>
            <div className="mt-10 space-y-3" aria-hidden="true">
              <div className="rise ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-indigo-500 px-4 py-3 text-sm">
                {story.ask}
              </div>
              <div className="rise rise-2 flex flex-wrap gap-2 text-xs">
                {story.tags.map((t) => <span key={t} className="rounded-full bg-white/10 px-3 py-1">{t}</span>)}
                <span className="rounded-full bg-amber-400/20 px-3 py-1 text-amber-200">{story.flag}</span>
              </div>
              <div className="rise rise-3 w-fit max-w-[85%] rounded-2xl rounded-bl-sm bg-navy-soft px-4 py-3 text-sm text-slate-200">
                {story.reply}
                <p className="mt-2 text-xs text-slate-400">{story.source}</p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-5">
          <p className="text-xs text-slate-500">
            {staff
              ? "Every staff sign-in is recorded in the audit log."
              : "AI answers from approved company policies only. Sensitive requests always go to a person."}
          </p>
          <div className="border-t border-white/10 pt-5"><TeamCredit tone="light" /></div>
        </div>
      </aside>

      <main className="flex flex-1 items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-[26rem]">
          <div className="mb-8 lg:hidden"><Logo /></div>
          {industry && (
            <div className="mb-6 flex flex-wrap items-center gap-2 text-xs text-muted">
              <span>Choose a demo:</span>
              <PackSwitch current={industry} />
            </div>
          )}
          <h2 className="text-2xl font-bold text-ink">{title}</h2>
          <p className="mb-7 mt-1 text-muted">{subtitle}</p>
          {children}
          <div className="mt-10 border-t border-slate-200 pt-5 lg:hidden"><TeamCredit /></div>
        </div>
      </main>
    </div>
  );
}
