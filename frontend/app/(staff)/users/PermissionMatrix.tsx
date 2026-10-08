"use client";

import { useState, useTransition } from "react";
import { togglePermission } from "./actions";

const ROLES = [
  ["administrator", "Administrator"], ["team_leader", "Team Leader"], ["support_agent", "Support Agent"],
  ["knowledge_manager", "Knowledge Manager"], ["business_specialist", "Business Specialist"],
] as const;
const PERMS = [
  ["view_cases", "View cases", "Conversations, Cases, Customers"],
  ["resolve_cases", "Resolve cases", "Reply, take over, resolve"],
  ["manage_knowledge", "Manage knowledge", "Knowledge Base"],
  ["configure_ai", "Configure AI", "AI Agents, Routing, Settings"],
  ["view_analytics", "View analytics", "Analytics, Team Operations"],
  ["view_audit_logs", "Audit logs", "Audit Logs"],
  ["manage_users", "Manage users", "Users & Roles"],
] as const;

// Each tick decides what a role sees in the menu and which pages it can open.
export default function PermissionMatrix({ granted }: { granted: string[] }) {
  const [on, setOn] = useState(new Set(granted));
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function flip(role: string, perm: string) {
    const key = `${role}:${perm}`;
    const next = !on.has(key);
    setError(undefined);
    setOn((s) => { const n = new Set(s); if (next) n.add(key); else n.delete(key); return n; });
    start(async () => {
      const r = await togglePermission(role, perm, next);
      if (r.error) {
        setError(r.error);
        setOn((s) => { const n = new Set(s); if (next) n.delete(key); else n.add(key); return n; });
      }
    });
  }

  return (
    <div className="rounded-xl border bg-white">
      <div className="border-b p-4">
        <h2 className="font-bold text-ink">What each role can do</h2>
        <p className="text-sm text-muted">Tick or untick to change access. It applies the next time people open a page. Customers always see only their own requests.</p>
        {error && <p role="alert" className="mt-2 text-sm text-bad">{error}</p>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-muted">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Role</th>
              {PERMS.map(([k, label, opens]) => (
                <th key={k} className="px-3 py-3 text-center font-semibold" title={`Opens: ${opens}`}>
                  {label}<span className="block text-[11px] font-normal">{opens}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {ROLES.map(([role, label]) => (
              <tr key={role}>
                <td className="px-4 py-3 font-semibold text-ink">{label}</td>
                {PERMS.map(([perm, plabel]) => {
                  const locked = role === "administrator" && perm === "manage_users";
                  return (
                    <td key={perm} className="px-3 py-3 text-center">
                      <input type="checkbox" checked={on.has(`${role}:${perm}`)} disabled={locked || pending}
                        onChange={() => flip(role, perm)} aria-label={`${label}: ${plabel}`}
                        title={locked ? "Administrators always keep Manage users" : undefined}
                        className="h-4 w-4 accent-indigo-600 disabled:opacity-60" />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
