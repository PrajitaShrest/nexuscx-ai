"use client";

import { useActionState, useState, useTransition } from "react";
import type { Address } from "@/lib/data/shop";
import { displayMobile } from "@/lib/auth/phone";
import Field, { inputClass } from "@/components/Field";
import { EmptyState, btnGhost, btnPrimary } from "@/components/ShopUI";
import { MapPinIcon, PlusIcon, TrashIcon } from "@/components/Icons";
import { makeDefault, remove, save, type AddressState } from "./actions";

const STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];
const LABELS = ["Home", "Work", "Other"];

function AddressForm({ a, next, onCancel }: { a?: Address; next: string; onCancel: () => void }) {
  const [state, action, pending] = useActionState<AddressState, FormData>(save, {});
  const err = (f: string) => (state.field === f ? state.error : undefined);
  const [label, setLabel] = useState(a?.label ?? "Home");
  return (
    <form action={action} className="space-y-4 rounded-3xl border border-indigo-200 bg-white p-5 shadow-sm ring-4 ring-indigo-50 sm:p-6">
      <h2 className="text-lg font-bold">{a ? "Edit address" : "Add a new address"}</h2>
      <input type="hidden" name="address_id" value={a?.address_id ?? ""} />
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="label" value={label} />
      <div className="flex gap-2" role="group" aria-label="Address label">
        {LABELS.map((l) => (
          <button key={l} type="button" onClick={() => setLabel(l)} aria-pressed={label === l}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${label === l ? "bg-indigo-600 text-white" : "border border-slate-200 text-slate-700 hover:bg-slate-50"}`}>{l}</button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Recipient name" htmlFor="recipient" error={err("recipient")}>
          <input id="recipient" name="recipient" defaultValue={a?.recipient} required autoComplete="name" className={inputClass(!!err("recipient"))} />
        </Field>
        <Field label="Mobile for the courier" htmlFor="phone" error={err("phone")} hint="Optional">
          <input id="phone" name="phone" type="tel" defaultValue={displayMobile(a?.phone ?? null)} placeholder="0412 345 678" autoComplete="tel" className={inputClass(!!err("phone"))} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Street address" htmlFor="line1" error={err("line1")}>
            <input id="line1" name="line1" defaultValue={a?.line1} required autoComplete="address-line1" placeholder="12 Example St" className={inputClass(!!err("line1"))} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Apartment, unit or building" htmlFor="line2" hint="Optional">
            <input id="line2" name="line2" defaultValue={a?.line2 ?? ""} autoComplete="address-line2" className={inputClass()} />
          </Field>
        </div>
        <Field label="Suburb" htmlFor="suburb" error={err("suburb")}>
          <input id="suburb" name="suburb" defaultValue={a?.suburb} required autoComplete="address-level2" className={inputClass(!!err("suburb"))} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="State" htmlFor="state">
            <select id="state" name="state" defaultValue={a?.state ?? "NSW"} className={inputClass()}>
              {STATES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Postcode" htmlFor="postcode" error={err("postcode")}>
            <input id="postcode" name="postcode" defaultValue={a?.postcode} required inputMode="numeric" maxLength={4} pattern="\d{4}" autoComplete="postal-code" className={inputClass(!!err("postcode"))} />
          </Field>
        </div>
      </div>
      <label className="flex items-center gap-2.5 text-sm">
        <input type="checkbox" name="is_default" defaultChecked={a?.is_default} className="h-4 w-4 accent-indigo-600" /> Use as my default delivery address
      </label>
      {state.error && !state.field && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-bad">{state.error}</p>}
      <div className="flex gap-2">
        <button className={btnPrimary} disabled={pending}>{pending ? "Saving…" : "Save address"}</button>
        <button type="button" onClick={onCancel} className={btnGhost}>Cancel</button>
      </div>
    </form>
  );
}

export default function AddressBook({ addresses, next }: { addresses: Address[]; next: string }) {
  const [editing, setEditing] = useState<string | "new" | null>(addresses.length === 0 ? "new" : null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const run = (fn: () => Promise<{ error?: string }>) => start(async () => { const r = await fn(); setError(r.error ?? null); setConfirm(null); });

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-bad">{error}</p>}
      {editing === "new" ? <AddressForm next={next} onCancel={() => setEditing(null)} /> : addresses.length < 10 && (
        <button type="button" onClick={() => setEditing("new")} className={btnPrimary}><PlusIcon className="h-4 w-4" /> Add address</button>
      )}
      {addresses.length === 0 && editing !== "new" && (
        <EmptyState icon={<MapPinIcon className="h-6 w-6" />} title="No saved addresses" text="Add one to make checkout quick." />
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {addresses.map((a) => editing === a.address_id ? (
          <div key={a.address_id} className="md:col-span-2"><AddressForm a={a} next={next} onCancel={() => setEditing(null)} /></div>
        ) : (
          <article key={a.address_id} className={`rounded-3xl border bg-white p-5 shadow-sm ${a.is_default ? "border-indigo-300 ring-4 ring-indigo-50" : "border-slate-200"}`}>
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><MapPinIcon className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold">{a.label}
                  {a.is_default && <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[11px] font-semibold text-white">Default</span>}
                </p>
                <p className="mt-1 text-sm">{a.recipient}</p>
                <p className="text-sm text-muted">{a.line1}{a.line2 ? `, ${a.line2}` : ""}</p>
                <p className="text-sm text-muted">{a.suburb} {a.state} {a.postcode}</p>
                {a.phone && <p className="mt-1 text-xs text-muted">{displayMobile(a.phone)}</p>}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4 text-sm">
              <button type="button" onClick={() => setEditing(a.address_id)} className="rounded-lg px-3 py-1.5 font-semibold text-indigo-700 hover:bg-indigo-50">Edit</button>
              {!a.is_default && <button type="button" disabled={busy} onClick={() => run(() => makeDefault(a.address_id))} className="rounded-lg px-3 py-1.5 font-semibold text-ink hover:bg-slate-100">Make default</button>}
              {confirm === a.address_id ? (
                <span className="ml-auto flex items-center gap-2">
                  <span className="text-bad">Delete?</span>
                  <button type="button" disabled={busy} onClick={() => run(() => remove(a.address_id))} className="rounded-lg bg-red-600 px-3 py-1.5 font-semibold text-white">Yes</button>
                  <button type="button" onClick={() => setConfirm(null)} className="rounded-lg px-3 py-1.5 font-semibold hover:bg-slate-100">No</button>
                </span>
              ) : (
                <button type="button" onClick={() => setConfirm(a.address_id)} aria-label={`Delete ${a.label} address`} className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-bad"><TrashIcon className="h-4 w-4" /></button>
              )}
            </div>
          </article>
        ))}
      </div>
      <p className="text-xs text-muted">Changing an address never changes orders you have already placed.</p>
    </div>
  );
}
