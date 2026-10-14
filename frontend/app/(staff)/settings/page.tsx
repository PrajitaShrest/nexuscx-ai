import Sidebar from "@/components/Sidebar";
import NoAccess from "@/components/NoAccess";
import AdminForm from "@/components/AdminForm";
import { field } from "@/components/admin-ui";
import { ShieldIcon } from "@/components/Icons";
import { can, getMe } from "@/lib/data/me";
import { listSettings, type Setting } from "@/lib/data/ops";
import { ago } from "@/lib/format";
import { saveSetting, saveSla } from "../admin-actions";

const SECTIONS: { category: string; title: string; note: string }[] = [
  { category: "general", title: "General", note: "Name, language and time zone. The time zone is used for the busiest-hours chart." },
  { category: "ai_configuration", title: "AI behaviour", note: "These change how the AI answers. They stay in step with the matching escalation rules." },
  { category: "ai_safety", title: "Safety", note: "Always on. They protect customers and cannot be switched off here or in the database." },
  { category: "notifications", title: "Notifications", note: "Saved now. Alerts will follow these switches once email alerts are added." },
  { category: "integrations", title: "Integrations", note: "Connection status of outside channels. Connecting a real channel is planned after Week 9." },
];
const LABEL: Record<string, string> = {
  platform_name: "Platform name", default_language: "Default language", timezone: "Time zone",
  confidence_threshold: "Confidence threshold", auto_escalate_angry: "Escalate angry customers", auto_escalate_high_risk: "Escalate high-risk cases",
  knowledge_approval_required: "Only use approved articles", prompt_injection_protection: "Prompt injection protection",
  sensitive_data_redaction: "Hide card numbers and personal data", policy_enforcement: "Block restricted actions", audit_logging: "Audit logging",
  notify_sla_breach: "SLA breach alerts", notify_new_escalation: "New escalation alerts", notify_low_confidence: "Low-confidence alerts",
  integration_email: "Email", integration_slack: "Slack",
};
const LOCKED = new Set(["knowledge_approval_required"]);
const LANGS = [["en", "English"], ["es", "Spanish"], ["zh", "Chinese"], ["hi", "Hindi"], ["ne", "Nepali"], ["ar", "Arabic"]];
const ZONES = ["Australia/Sydney", "Australia/Melbourne", "Australia/Brisbane", "Australia/Adelaide", "Australia/Perth", "Australia/Hobart", "Australia/Darwin", "Pacific/Auckland", "UTC"];
const mins = (m: number) => (m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 6) / 10} h` : `${Math.round(m / 144) / 10} days`);

function SettingRow({ s }: { s: Setting }) {
  const label = LABEL[s.setting_key] ?? s.setting_key;
  const locked = s.category === "ai_safety" || LOCKED.has(s.setting_key);
  const changed = s.updated_by_name ? `Changed by ${s.updated_by_name} ${ago(s.updated_at)}` : null;
  const text = (
    <div className="min-w-0 flex-1">
      <p className="font-medium">{label}</p>
      <p className="text-xs text-gray-500">{s.description}{changed ? ` · ${changed}` : ""}</p>
    </div>
  );
  if (locked) {
    return (
      <li className="flex items-center gap-3 py-3 text-sm">
        {text}
        <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"><ShieldIcon className="h-3.5 w-3.5" /> Always on</span>
      </li>
    );
  }
  const kind = typeof s.value;
  return (
    <li className="py-3 text-sm">
      <AdminForm action={saveSetting} compact className="flex flex-wrap items-center gap-3">
        {text}
        <input type="hidden" name="key" value={s.setting_key} />
        <input type="hidden" name="kind" value={kind} />
        {kind === "boolean" ? (
          <label className="flex items-center gap-2"><input type="checkbox" name="value" defaultChecked={s.value === true} className="h-4 w-4 accent-indigo-600" /> On</label>
        ) : s.setting_key === "confidence_threshold" ? (
          <input name="value" type="number" step="0.05" min={0.3} max={0.95} defaultValue={String(s.value)} aria-label={label} className={`${field} w-24`} />
        ) : s.setting_key === "default_language" ? (
          <select name="value" defaultValue={String(s.value)} aria-label={label} className={field}>{LANGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        ) : s.setting_key === "timezone" ? (
          <select name="value" defaultValue={String(s.value)} aria-label={label} className={field}>{ZONES.map((z) => <option key={z}>{z}</option>)}</select>
        ) : s.setting_key.startsWith("integration_") ? (
          <select name="value" defaultValue={String(s.value)} aria-label={label} className={field}><option value="connected">Connected</option><option value="disconnected">Disconnected</option></select>
        ) : (
          <input name="value" defaultValue={String(s.value)} maxLength={60} aria-label={label} className={`${field} w-56`} />
        )}
      </AdminForm>
    </li>
  );
}

export default async function SettingsPage() {
  const me = await getMe();
  if (!can(me, "configure_ai")) return <NoAccess me={me} page="Settings" needs="configure_ai" />;
  const { settings, sla, error } = await listSettings();

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900">
      <Sidebar me={me} active="/settings" />
      <main className="min-w-0 flex-1 space-y-6 p-6">
        <div>
          <h1 className="text-xl font-semibold">Settings</h1>
          <p className="text-sm text-gray-500">Platform settings. Every change is checked by the database and saved in the audit log.</p>
        </div>
        {error && <p role="alert" className="rounded-md bg-red-50 p-3 text-red-700">{error}</p>}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {SECTIONS.map((sec) => {
            const rows = settings.filter((s) => s.category === sec.category);
            if (rows.length === 0) return null;
            return (
              <section key={sec.category} className="rounded-xl border bg-white p-4">
                <h2 className="font-semibold">{sec.title}</h2>
                <p className="text-xs text-gray-500">{sec.note}</p>
                <ul className="divide-y">{rows.map((s) => <SettingRow key={s.setting_key} s={s} />)}</ul>
              </section>
            );
          })}
          <section className="rounded-xl border bg-white p-4">
            <h2 className="font-semibold">Response time targets (SLA)</h2>
            <p className="text-xs text-gray-500">In minutes. Used to set each new case&apos;s due time and the SLA numbers on the dashboard.</p>
            <ul className="divide-y">
              {sla.map((p) => (
                <li key={p.priority} className="py-3 text-sm">
                  <AdminForm action={saveSla} compact className="flex flex-wrap items-center gap-3">
                    <input type="hidden" name="priority" value={p.priority} />
                    <span className="w-16 font-medium capitalize">{p.priority}</span>
                    <label className="flex items-center gap-1.5 text-gray-600">Reply <input name="first" type="number" min={1} max={1440} defaultValue={p.first_response_minutes} aria-label={`First reply minutes, ${p.priority}`} className={`${field} w-16`} /></label>
                    <label className="flex items-center gap-1.5 text-gray-600" title={mins(p.resolution_minutes)}>Resolve <input name="resolution" type="number" min={1} max={20160} defaultValue={p.resolution_minutes} aria-label={`Resolve minutes, ${p.priority}`} className={`${field} w-20`} /></label>
                  </AdminForm>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}
