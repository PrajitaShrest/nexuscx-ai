import Sidebar from "@/components/Sidebar";
import NoAccess from "@/components/NoAccess";
import AdminForm from "@/components/AdminForm";
import { field } from "@/components/admin-ui";
import { BotIcon } from "@/components/Icons";
import { can, getMe } from "@/lib/data/me";
import { listAgents } from "@/lib/data/ops";
import { ISSUE_LABEL } from "@/lib/data/stats";
import { ago } from "@/lib/format";
import { saveAgent } from "../admin-actions";

const TYPE: Record<string, string> = { orchestrator: "Orchestrator", classifier: "Classifier", specialist: "Specialist", safety: "Safety", builder: "Builder", policy: "Policy" };
const CORE = ["orchestrator", "classifier", "safety", "policy"];
const HEALTH: Record<string, string> = { healthy: "bg-emerald-500", degraded: "bg-amber-500", offline: "bg-red-500" };

export default async function AgentsPage() {
  const me = await getMe();
  if (!can(me, "configure_ai")) return <NoAccess me={me} page="AI Agents" needs="configure_ai" />;
  const { data: agents, error } = await listAgents();
  const groups = [["Core pipeline", agents.filter((a) => CORE.includes(a.type))], ["Specialists", agents.filter((a) => a.type === "specialist")], ["Other", agents.filter((a) => !CORE.includes(a.type) && a.type !== "specialist")]] as const;

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900">
      <Sidebar me={me} active="/ai-agents" />
      <main className="min-w-0 flex-1 space-y-6 p-6">
        <div>
          <h1 className="text-xl font-semibold">AI Agents</h1>
          <p className="text-sm text-gray-500">Every message passes the core agents, then goes to a specialist. Pausing a specialist sends its topics to people instead.</p>
        </div>
        {error && <p role="alert" className="rounded-md bg-red-50 p-3 text-red-700">{error}</p>}
        {groups.map(([title, list]) => list.length > 0 && (
          <section key={title}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">{title}</h2>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {list.map((a) => {
                const core = CORE.includes(a.type);
                return (
                  <article key={a.agent_id} className="rounded-xl border bg-white p-4">
                    <div className="flex items-start gap-3">
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${a.status === "active" ? "bg-indigo-50 text-indigo-600" : "bg-gray-100 text-gray-400"}`}><BotIcon className="h-5 w-5" /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">{a.name}</h3>
                          <span className="rounded bg-gray-100 px-1.5 text-[11px] text-gray-600">{TYPE[a.type] ?? a.type}</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs ${a.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{a.status === "active" ? "Active" : "Paused"}</span>
                        </div>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500">
                          <span className={`h-2 w-2 rounded-full ${HEALTH[a.health] ?? "bg-gray-300"}`} aria-hidden /> {a.health} · {a.model_name ?? "no model"}{a.department ? ` · ${a.department}` : ""} · changed {ago(a.updated_at)}
                        </p>
                      </div>
                    </div>
                    <dl className="mt-3 grid grid-cols-4 gap-2 rounded-lg bg-gray-50 p-2 text-center text-xs">
                      {[["Requests", a.requests], ["Resolved", a.resolution_pct !== null ? `${a.resolution_pct}%` : "—"], ["Escalated", a.escalation_pct !== null ? `${a.escalation_pct}%` : "—"], ["Confidence", a.avg_confidence_pct !== null ? `${a.avg_confidence_pct}%` : "—"]].map(([k, v]) => (
                        <div key={k}><dt className="text-gray-500">{k}</dt><dd className="text-sm font-semibold">{v}</dd></div>
                      ))}
                    </dl>
                    {a.intents.length > 0 && <p className="mt-2 text-xs text-gray-600">Handles: {a.intents.map((i) => ISSUE_LABEL[i] ?? i).join(", ")}</p>}
                    <AdminForm action={saveAgent} className="mt-3 space-y-2">
                      <input type="hidden" name="agent_id" value={a.agent_id} />
                      <label className="flex items-center gap-2 text-sm">
                        Status
                        <select name="status" defaultValue={a.status === "active" ? "active" : "testing"} disabled={core} className={field}>
                          <option value="active">Active</option>
                          <option value="testing">Paused (send to people)</option>
                        </select>
                        {core && <input type="hidden" name="status" value="active" />}
                        {core && <span className="text-xs text-gray-500">Core agents are always on.</span>}
                      </label>
                      <label className="block text-sm">
                        Instructions <span className="text-xs text-gray-500">(kept with the agent and in the audit log; the current rules-based AI does not read them yet)</span>
                        <textarea name="instructions" rows={2} maxLength={4000} defaultValue={a.system_instructions ?? ""} placeholder="e.g. Always confirm the order number before giving delivery dates."
                          className={`${field} mt-1 block w-full`} />
                      </label>
                    </AdminForm>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
