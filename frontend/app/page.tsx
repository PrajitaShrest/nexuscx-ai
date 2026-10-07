"use client";

import { useEffect, useState } from "react";

type Case = {
  case_id: string;
  customer: string;
  intent: string | null;
  priority: string;
  risk: string | null;
  confidence: string | null;
  status: string;
  created_at: string;
  subject: string | null;
};

// Intent -> category tag (matches the Figma prototype)
const CATEGORY: Record<string, { label: string; style: string }> = {
  order_status: { label: "Order", style: "border-blue-300 bg-blue-50 text-blue-700" },
  return_request: { label: "Order", style: "border-blue-300 bg-blue-50 text-blue-700" },
  billing_question: { label: "Billing", style: "border-green-300 bg-green-50 text-green-700" },
  refund_request: { label: "Billing", style: "border-green-300 bg-green-50 text-green-700" },
  technical_issue: { label: "Technical", style: "border-orange-300 bg-orange-50 text-orange-700" },
};

// Case status -> badge (matches the Figma prototype)
const STATUS: Record<string, { label: string; style: string }> = {
  open: { label: "AI Handling", style: "border-indigo-300 bg-indigo-50 text-indigo-700" },
  in_progress: { label: "Waiting", style: "border-amber-300 bg-amber-50 text-amber-700" },
  escalated: { label: "Escalated", style: "border-red-300 bg-red-50 text-red-700" },
  resolved: { label: "Resolved", style: "border-emerald-300 bg-emerald-50 text-emerald-700" },
  closed: { label: "Closed", style: "border-gray-300 bg-gray-50 text-gray-600" },
};

const TABS = ["All", "AI Handling", "Escalated", "Resolved"];

const NAV = [
  { section: "", items: ["Conversations", "Cases", "Customers"] },
  { section: "AI OPERATIONS", items: ["AI Agents", "Routing & Escalation", "Knowledge Base"] },
  { section: "INSIGHTS", items: ["Analytics", "Team Operations"] },
  { section: "ADMINISTRATION", items: ["Users & Roles", "Audit Logs", "Settings"] },
];

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

function time(iso: string) {
  return new Date(iso).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });
}

export default function ConversationsPage() {
  const [cases, setCases] = useState<Case[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("All");

  // Frontend -> API -> database: the Week 5 vertical slice
  useEffect(() => {
    fetch("/api/cases")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setCases(data);
      })
      .catch(() => setError("Could not reach the API"))
      .finally(() => setLoading(false));
  }, []);

  const shown = cases.filter((c) => tab === "All" || STATUS[c.status]?.label === tab);

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900">
      {/* Sidebar */}
      <aside className="hidden w-64 flex-col bg-[#0f172a] text-gray-300 md:flex">
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500 font-bold text-white">N</div>
          <div>
            <p className="font-semibold text-white">NexusCX AI</p>
            <p className="text-xs text-gray-400">Customer Platform</p>
          </div>
        </div>
        <nav className="flex-1 space-y-4 px-3">
          {NAV.map((group) => (
            <div key={group.section}>
              {group.section && <p className="px-2 pb-1 text-[11px] font-semibold tracking-wider text-gray-500">{group.section}</p>}
              {group.items.map((item) => (
                <p
                  key={item}
                  className={`rounded-md px-2 py-2 text-sm ${item === "Conversations" ? "bg-indigo-600 text-white" : "hover:bg-white/5"}`}
                >
                  {item}
                </p>
              ))}
            </div>
          ))}
        </nav>
        <div className="flex items-center gap-3 border-t border-white/10 px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500 text-sm text-white">A</div>
          <div>
            <p className="text-sm text-white">Alex Morgan</p>
            <p className="text-xs text-gray-400">Agent</p>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1">
        <header className="flex items-center justify-between border-b bg-white px-6 py-4">
          <h1 className="text-xl font-semibold">Conversations</h1>
          <span className="rounded-full border border-green-300 bg-green-50 px-3 py-1 text-sm text-green-700">
            ● AI Systems Online
          </span>
        </header>

        <div className="mx-auto max-w-3xl p-6">
          <div className="mb-4 flex gap-4 border-b">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`pb-2 text-sm ${tab === t ? "border-b-2 border-indigo-600 font-semibold text-indigo-600" : "text-gray-500"}`}
              >
                {t}
              </button>
            ))}
          </div>

          {loading && <p className="text-gray-500">Loading cases from the database…</p>}
          {error && <p className="rounded-md bg-red-50 p-3 text-red-700">{error}</p>}
          {!loading && !error && shown.length === 0 && <p className="text-gray-500">No cases here.</p>}

          <ul className="divide-y rounded-lg border bg-white">
            {shown.map((c) => {
              const cat = CATEGORY[c.intent ?? ""] ?? { label: c.intent ?? "General", style: "border-gray-300 bg-gray-50 text-gray-600" };
              const st = STATUS[c.status] ?? STATUS.open;
              return (
                <li key={c.case_id} className="flex gap-4 p-4 hover:bg-gray-50">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-500 text-sm font-semibold text-white">
                    {initials(c.customer)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between">
                      <p className="font-semibold">{c.customer}</p>
                      <p className="text-sm text-gray-500">{time(c.created_at)}</p>
                    </div>
                    <p className="truncate text-sm text-gray-600">{c.subject ?? "(no message yet)"}</p>
                    <div className="mt-2 flex justify-between">
                      <span className={`rounded-full border px-2.5 py-0.5 text-xs ${cat.style}`}>{cat.label}</span>
                      <span className={`rounded-full border px-2.5 py-0.5 text-xs ${st.style}`}>{st.label}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-gray-400">{cases.length} cases loaded live from Supabase via GET /api/cases</p>
        </div>
      </main>
    </div>
  );
}
