"use client";

import { useActionState, useState } from "react";
import FormMessage from "@/components/FormMessage";
import type { Overview } from "@/lib/data/admin";
import {
  deleteUser, emailReset, saveDetails, saveRoles, setStatus, tempPassword, unlock, type AdminState,
} from "../actions";

const STAFF = ["support_agent", "team_leader", "knowledge_manager", "business_specialist", "administrator"];
const LABEL: Record<string, string> = {
  customer: "Customer", support_agent: "Support Agent", team_leader: "Team Leader",
  knowledge_manager: "Knowledge Manager", business_specialist: "Business Specialist", administrator: "Administrator",
};
const input = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100";
const btn = "rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50";
const btnGhost = "rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50";
const empty: AdminState = {};

function Card({ title, hint, children, danger }: { title: string; hint?: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <section className={`rounded-xl border bg-white p-5 ${danger ? "border-red-200" : ""}`}>
      <h2 className={`font-semibold ${danger ? "text-bad" : ""}`}>{title}</h2>
      {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function makePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const a = new Uint32Array(10);
  crypto.getRandomValues(a);
  return Array.from(a, (n) => chars[n % chars.length]).join("") + "7!";
}

export default function ManagePerson({ person: p, teams }: { person: Overview; teams: { team_id: string; name: string }[] }) {
  const [details, detailsAct, detailsBusy] = useActionState(saveDetails, empty);
  const [roles, rolesAct, rolesBusy] = useActionState(saveRoles, empty);
  const [status, statusAct, statusBusy] = useActionState(setStatus, empty);
  const [unl, unlockAct, unlockBusy] = useActionState(unlock, empty);
  const [mail, mailAct, mailBusy] = useActionState(emailReset, empty);
  const [temp, tempAct, tempBusy] = useActionState(tempPassword, empty);
  const [del, delAct, delBusy] = useActionState(deleteUser, empty);

  const [primary, setPrimary] = useState(p.role);
  const [extra, setExtra] = useState<string[]>(p.extra_roles);
  const [pw, setPw] = useState("");
  const [copied, setCopied] = useState(false);
  const isCustomer = primary === "customer";
  const toggleExtra = (r: string) =>
    setExtra((x) => (x.includes(r) ? x.filter((y) => y !== r) : x.length >= 2 ? x : [...x, r]));
  const hidden = <input type="hidden" name="user_id" value={p.user_id} />;

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title="Details" hint="Name and team shown to other staff.">
        <form action={detailsAct} className="space-y-3">
          {hidden}
          <label className="block text-sm font-medium">Full name
            <input name="name" defaultValue={p.name} required minLength={2} maxLength={100} className={`mt-1 ${input}`} />
          </label>
          <label className="block text-sm font-medium">Team
            <select name="team_id" defaultValue={p.team_id ?? ""} className={`mt-1 ${input}`}>
              <option value="">No team</option>
              {teams.map((t) => <option key={t.team_id} value={t.team_id}>{t.name}</option>)}
            </select>
          </label>
          <FormMessage {...details} />
          <button className={btn} disabled={detailsBusy}>{detailsBusy ? "Saving…" : "Save details"}</button>
        </form>
      </Card>

      <Card title="Roles" hint="One main role. Staff can cover up to 2 extra roles when the team is short. They get the permissions of all their roles.">
        <form action={rolesAct} className="space-y-3">
          {hidden}
          <label className="block text-sm font-medium">Main role
            <select name="primary" value={primary} onChange={(e) => { setPrimary(e.target.value); setExtra((x) => x.filter((r) => r !== e.target.value)); }}
              className={`mt-1 ${input}`}>
              {["customer", ...STAFF].map((r) => <option key={r} value={r}>{LABEL[r]}</option>)}
            </select>
          </label>
          <fieldset disabled={isCustomer}>
            <legend className="text-sm font-medium">Extra roles <span className="font-normal text-muted">({extra.length}/2)</span></legend>
            {isCustomer && <p className="text-xs text-muted">Customers can&apos;t hold staff roles.</p>}
            <div className="mt-2 grid grid-cols-2 gap-2">
              {STAFF.filter((r) => r !== primary).map((r) => {
                const on = extra.includes(r);
                return (
                  <label key={r} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${on ? "border-indigo-400 bg-indigo-50" : "border-slate-200"} ${!on && extra.length >= 2 ? "opacity-50" : ""}`}>
                    <input type="checkbox" name="extra" value={r} checked={on && !isCustomer} onChange={() => toggleExtra(r)}
                      disabled={!on && extra.length >= 2} className="accent-indigo-600" />
                    {LABEL[r]}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <FormMessage {...roles} />
          <button className={btn} disabled={rolesBusy}>{rolesBusy ? "Saving…" : "Save roles"}</button>
        </form>
      </Card>

      <Card title="Password" hint="Never shown or stored in plain text. Choose one way to help them back in.">
        <form action={mailAct} className="flex flex-wrap items-center gap-3">
          {hidden}
          <button className={btnGhost} disabled={mailBusy || !p.has_login}>{mailBusy ? "Sending…" : "Email a reset link"}</button>
          <span className="text-xs text-muted">Safest: they choose their own password.</span>
        </form>
        <FormMessage {...mail} />
        <form action={tempAct} className="space-y-2 border-t pt-3">
          {hidden}
          <label className="block text-sm font-medium">Or set a temporary password</label>
          <div className="flex gap-2">
            <input name="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 8 letters and numbers"
              minLength={8} required autoComplete="new-password" className={input} />
            <button type="button" className={btnGhost} onClick={() => { setPw(makePassword()); setCopied(false); }}>Generate</button>
          </div>
          <p className="text-xs text-muted">They must change it the first time they sign in.</p>
          <button className={btn} disabled={tempBusy || !p.has_login}>{tempBusy ? "Setting…" : "Set temporary password"}</button>
        </form>
        <FormMessage error={temp.error} ok={temp.ok} />
        {temp.secret && (
          <div className="flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 font-mono text-sm text-white">
            <span className="flex-1">{temp.secret}</span>
            <button type="button" className="text-xs underline" onClick={() => { navigator.clipboard.writeText(temp.secret!); setCopied(true); }}>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        )}
        {!p.has_login && <p className="text-xs text-muted">This person has no login yet, so password tools are off.</p>}
      </Card>

      <Card title="Access" hint="Suspend to block sign-in without losing anything. Unlock clears a lock from wrong passwords.">
        <form action={statusAct} className="flex flex-wrap items-center gap-3">
          {hidden}
          <input type="hidden" name="status" value={p.status === "suspended" ? "active" : "suspended"} />
          {p.status === "suspended" ? (
            <button className={btn} disabled={statusBusy}>Reactivate account</button>
          ) : (
            <button className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-bad hover:bg-red-50 disabled:opacity-50"
              disabled={statusBusy || p.is_self}>Suspend account</button>
          )}
          <span className="text-sm text-muted">Now: {p.status === "suspended" ? "Suspended" : "Active"}</span>
        </form>
        <FormMessage {...status} />
        <form action={unlockAct} className="flex flex-wrap items-center gap-3 border-t pt-3">
          {hidden}
          <button className={btnGhost} disabled={unlockBusy || p.locked_seconds <= 0}>Unlock sign-in</button>
          <span className="text-sm text-muted">
            {p.locked_seconds > 0 ? `Locked for ${Math.ceil(p.locked_seconds / 60)} more min` : "Not locked"}
          </span>
        </form>
        <FormMessage {...unl} />
      </Card>

      <div className="lg:col-span-2">
        <Card danger title="Delete account" hint={p.case_count > 0
          ? `This person has ${p.case_count} case(s). Their history is kept for the records, but their name, email and login are removed.`
          : "Removes this person and their login for good. This can't be undone."}>
          <form action={delAct} className="flex flex-wrap items-end gap-3">
            {hidden}
            <input type="hidden" name="expected" value={p.username} />
            <label className="block text-sm font-medium">Type <span className="font-mono">{p.username}</span> to confirm
              <input name="confirm" autoComplete="off" disabled={p.is_self} className={`mt-1 ${input} w-64`} />
            </label>
            <button className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              disabled={delBusy || p.is_self}>{delBusy ? "Deleting…" : "Delete account"}</button>
          </form>
          <FormMessage error={del.error} />
        </Card>
      </div>
    </div>
  );
}
