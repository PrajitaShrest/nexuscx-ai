import Sidebar from "@/components/Sidebar";
import NoAccess from "@/components/NoAccess";
import AdminForm from "@/components/AdminForm";
import { field } from "@/components/admin-ui";
import { can, getMe } from "@/lib/data/me";
import { listRules } from "@/lib/data/ops";
import { ISSUE_LABEL } from "@/lib/data/stats";
import { saveEscalation, saveRouting } from "../admin-actions";

// What each escalation condition means, in plain words, and which thresholds make sense.
const CONDITION: Record<string, { text: string; options?: string[]; number?: boolean; locked?: boolean }> = {
  confidence_below: { text: "AI confidence is below", number: true },
  sentiment_equals: { text: "Customer sentiment is", options: ["angry", "negative"] },
  urgency_equals: { text: "Urgency is", options: ["medium", "high", "critical"] },
  risk_equals: { text: "Risk is", options: ["medium", "high", "critical"] },
  sensitive_action: { text: "The customer asks for a refund, a bank or card change, account closure or mentions legal action", locked: true },
  prompt_injection: { text: "The message tries to trick the AI (prompt injection)", locked: true },
  agent_cannot_answer: { text: "No approved article answers the question" },
  customer_requests_human: { text: "The customer asks for a person" },
};
const ACTION: Record<string, string> = { escalate_to_human: "Escalate to a person", human_queue: "Put in the human queue", block_and_escalate: "Block the reply and escalate" };
const STEPS = ["Customer message", "Safety Checker", "Intent Classifier", "Escalation rules", "Routing rules", "Specialist agent or a person"];

export default async function RoutingPage() {
  const me = await getMe();
  if (!can(me, "configure_ai")) return <NoAccess me={me} page="Routing & Escalation" needs="configure_ai" />;
  const { routing, escalation, agents, error } = await listRules();

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900">
      <Sidebar me={me} active="/routing" />
      <main className="min-w-0 flex-1 space-y-6 p-6">
        <div>
          <h1 className="text-xl font-semibold">Routing & Escalation</h1>
          <p className="text-sm text-gray-500">These rules run inside the database for every new message. Changes apply to the next message straight away.</p>
        </div>
        <ol className="flex flex-wrap items-center gap-2 text-xs" aria-label="How a message is handled">
          {STEPS.map((s, i) => (
            <li key={s} className="flex items-center gap-2">
              <span className={`rounded-lg border px-2.5 py-1.5 ${i === 3 || i === 4 ? "border-indigo-300 bg-indigo-50 font-semibold text-indigo-800" : "bg-white text-gray-700"}`}>{i + 1}. {s}</span>
              {i < STEPS.length - 1 && <span aria-hidden className="text-gray-400">→</span>}
            </li>
          ))}
        </ol>
        {error && <p role="alert" className="rounded-md bg-red-50 p-3 text-red-700">{error}</p>}

        <section className="rounded-xl border bg-white p-4">
          <h2 className="font-semibold">Escalation rules</h2>
          <p className="mb-3 text-sm text-gray-500">Checked in order (lowest number first). The first rule that matches sends the case to a person.</p>
          <ul className="divide-y">
            {escalation.map((r) => {
              const c = CONDITION[r.condition_type] ?? { text: r.condition_type };
              return (
                <li key={r.rule_id} className="py-3">
                  <AdminForm action={saveEscalation} compact className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
                    <input type="hidden" name="rule_id" value={r.rule_id} />
                    <label className="flex items-center gap-1.5" title={c.locked ? "Always on" : undefined}>
                      <input type="checkbox" name="active" defaultChecked={r.status === "active"} disabled={c.locked} className="h-4 w-4 accent-indigo-600" />
                      {c.locked && <input type="hidden" name="active" value="on" />}
                      <span className="sr-only">Rule on</span>
                    </label>
                    <span className="w-40 font-medium">{r.name}{c.locked && <span className="ml-1 text-[11px] font-normal text-gray-500">(always on)</span>}</span>
                    <span className="min-w-48 flex-1 text-gray-600">
                      If {c.text.charAt(0).toLowerCase() + c.text.slice(1)}{" "}
                      {c.number && <input name="threshold" defaultValue={r.threshold_value ?? "0.70"} inputMode="decimal" aria-label="Confidence threshold" className={`${field} w-20`} />}
                      {c.options && (
                        <select name="threshold" defaultValue={r.threshold_value ?? c.options[0]} aria-label="Threshold" className={field}>
                          {c.options.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      )}
                    </span>
                    <select name="action" defaultValue={r.action} aria-label="Action" className={field} disabled={r.condition_type === "prompt_injection"}>
                      {Object.entries(ACTION).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                    {r.condition_type === "prompt_injection" && <input type="hidden" name="action" value="block_and_escalate" />}
                    <select name="severity" defaultValue={r.severity} aria-label="Severity" className={field}>
                      {["low", "medium", "high"].map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)} severity</option>)}
                    </select>
                    <label className="flex items-center gap-1 text-gray-500">Order <input name="priority" type="number" min={1} max={99} defaultValue={r.priority} className={`${field} w-16`} /></label>
                  </AdminForm>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-xl border bg-white p-4">
          <h2 className="font-semibold">Routing rules</h2>
          <p className="mb-3 text-sm text-gray-500">If no escalation rule matched, the topic decides which AI agent answers. A paused agent sends its topics to people.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-gray-500"><tr>{["Rule", "Topic", "Goes to", ""].map((h) => <th key={h} className="pb-2 pr-3">{h}</th>)}</tr></thead>
              <tbody className="divide-y">
                {routing.map((r) => (
                  <tr key={r.rule_id}>
                    <td className="py-3 pr-3 font-medium">{r.name}</td>
                    <td className="py-3 pr-3 text-gray-600">{r.intent ? ISSUE_LABEL[r.intent] ?? r.intent : "Any"}</td>
                    <td className="py-3" colSpan={2}>
                      <AdminForm action={saveRouting} compact className="flex flex-wrap items-center gap-3">
                        <input type="hidden" name="rule_id" value={r.rule_id} />
                        {r.action === "route_to_agent" ? (
                          <select name="agent_id" defaultValue={r.agent_id ?? ""} aria-label={`Agent for ${r.name}`} className={field}>
                            {agents.map((a) => <option key={a.agent_id} value={a.agent_id}>{a.name}{a.status !== "active" ? " (paused)" : ""}</option>)}
                          </select>
                        ) : <span className="text-gray-700">{r.action === "route_to_human" ? "A person" : "Blocked and escalated"}</span>}
                        <label className="flex items-center gap-1.5"><input type="checkbox" name="active" defaultChecked={r.status === "active"} className="h-4 w-4 accent-indigo-600" /> On</label>
                        <label className="flex items-center gap-1 text-gray-500">Order <input name="priority" type="number" min={1} max={99} defaultValue={r.priority} className={`${field} w-16`} /></label>
                      </AdminForm>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
