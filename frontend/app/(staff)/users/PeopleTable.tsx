"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Person } from "@/lib/data/admin";

const LABEL: Record<string, string> = {
  customer: "Customer", support_agent: "Support Agent", team_leader: "Team Leader",
  knowledge_manager: "Knowledge Manager", business_specialist: "Business Specialist", administrator: "Administrator",
};
const PRESENCE: Record<string, string> = { online: "bg-green-500", busy: "bg-amber-500", away: "bg-slate-400", offline: "bg-slate-300" };

export default function PeopleTable({ people, meId }: { people: Person[]; meId: string }) {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<"staff" | "customer" | "all">("staff");
  const shown = useMemo(() => people.filter((p) => {
    if (group === "staff" && p.role === "customer") return false;
    if (group === "customer" && p.role !== "customer") return false;
    const text = `${p.name} ${p.username} ${p.email}`.toLowerCase();
    return text.includes(q.trim().toLowerCase());
  }), [people, q, group]);

  return (
    <div className="rounded-xl border bg-white">
      <div className="flex flex-wrap items-center gap-3 border-b p-4">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, username or email"
          aria-label="Search people" className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" />
        <div className="flex rounded-lg border border-slate-300 p-0.5 text-sm" role="group" aria-label="Show">
          {(["staff", "customer", "all"] as const).map((g) => (
            <button key={g} type="button" onClick={() => setGroup(g)} aria-pressed={group === g}
              className={`rounded-md px-3 py-1.5 ${group === g ? "bg-indigo-600 text-white" : "text-ink hover:bg-slate-100"}`}>
              {g === "staff" ? "Staff" : g === "customer" ? "Customers" : "Everyone"}
            </button>
          ))}
        </div>
        <span className="ml-auto text-sm text-muted">{shown.length} shown</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs text-muted">
            <tr>{["Person", "Roles", "Team", "Status", ""].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {shown.map((p) => (
              <tr key={p.user_id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <p className="font-semibold text-ink">{p.name}{p.user_id === meId && <span className="ml-2 text-xs font-normal text-indigo-600">(you)</span>}</p>
                  <p className="text-xs text-muted">{p.username} · {p.email}</p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">{LABEL[p.role]}</span>
                    {p.extra_roles.map((r) => <span key={r} className="rounded-full border border-indigo-200 px-2.5 py-0.5 text-xs text-indigo-700">+ {LABEL[r]}</span>)}
                  </div>
                </td>
                <td className="px-4 py-3 text-muted">{p.team ?? "—"}</td>
                <td className="px-4 py-3">
                  {p.status === "suspended" ? (
                    <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-bad">Suspended</span>
                  ) : !p.has_login ? (
                    <span className="text-xs text-muted">No login yet</span>
                  ) : (
                    <span className="text-xs text-ink"><span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${PRESENCE[p.presence] ?? "bg-slate-300"}`} />{p.presence}</span>
                  )}
                  {p.must_change_password && <p className="mt-1 text-xs text-amber-700">Temporary password</p>}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/users/${p.user_id}`} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-ink hover:border-indigo-500 hover:text-indigo-700">
                    Manage
                  </Link>
                </td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">Nobody matches. Try a different search.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
