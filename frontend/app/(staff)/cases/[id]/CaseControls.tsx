"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addNote, reply, setStatus, take, updateReturn, type CaseActionState } from "./actions";
import { SendIcon } from "@/components/Icons";

const empty: CaseActionState = {};
const btn = "rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50";

function Msg({ s }: { s: CaseActionState }) {
  if (s.error) return <p role="alert" className="text-sm text-red-700">{s.error}</p>;
  if (s.ok) return <p role="status" className="text-sm text-green-700">{s.ok}</p>;
  return null;
}

// Take over / waiting / resolve / close / reopen
export function StatusBar({ caseId, status, mine, canEdit }: { caseId: string; status: string; mine: boolean; canEdit: boolean }) {
  const [t, takeAct, taking] = useActionState(take, empty);
  const [s, statusAct, setting] = useActionState(setStatus, empty);
  const [resolving, setResolving] = useState(false);
  if (!canEdit) return <p className="text-sm text-gray-500">You can view this case. Ask a team leader for the Resolve cases permission to work on it.</p>;
  const closed = status === "closed";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {!mine && !closed && (
          <form action={takeAct}><input type="hidden" name="case_id" value={caseId} />
            <button disabled={taking} className={`${btn} bg-indigo-600 text-white hover:bg-indigo-700`}>{taking ? "Taking…" : "Take over this case"}</button>
          </form>
        )}
        {!closed && (
          <form action={statusAct} className="flex flex-wrap gap-2">
            <input type="hidden" name="case_id" value={caseId} />
            {status !== "waiting" && <button name="status" value="waiting" disabled={setting} className={`${btn} border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100`}>Waiting for customer</button>}
            {status !== "resolved" && !resolving && <button type="button" onClick={() => setResolving(true)} className={`${btn} border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100`}>Resolve</button>}
            {status === "resolved" && <button name="status" value="human_handling" disabled={setting} className={`${btn} border border-gray-300 bg-white hover:bg-gray-50`}>Reopen</button>}
            <button name="status" value="closed" disabled={setting} className={`${btn} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50`}>Close case</button>
          </form>
        )}
        {closed && (
          <form action={statusAct}><input type="hidden" name="case_id" value={caseId} />
            <button name="status" value="human_handling" disabled={setting} className={`${btn} border border-gray-300 bg-white hover:bg-gray-50`}>Reopen case</button>
          </form>
        )}
      </div>
      {resolving && (
        <form action={statusAct} className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2">
          <input type="hidden" name="case_id" value={caseId} />
          <input type="hidden" name="status" value="resolved" />
          <input name="note" maxLength={200} placeholder="Summary for the customer (optional)" className="min-w-0 flex-1 rounded-md border border-emerald-200 px-2.5 py-1.5 text-sm" />
          <button disabled={setting} className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`}>Mark resolved</button>
          <button type="button" onClick={() => setResolving(false)} className={`${btn} text-gray-600`}>Cancel</button>
        </form>
      )}
      <Msg s={t.at && (!s.at || t.at > s.at) ? t : s} />
    </div>
  );
}

const QUICK = [
  "Thanks for your patience. I'm looking into this now.",
  "Could you send a photo of the item so we can check it?",
  "I've arranged a replacement. You'll get a tracking number by email.",
  "Your refund has been processed and should appear in 3 to 5 business days.",
  "Is there anything else I can help you with?",
];

// Reply box for staff
export function Composer({ caseId, disabled, firstName }: { caseId: string; disabled: boolean; firstName: string }) {
  const [s, act, pending] = useActionState(reply, empty);
  const [text, setText] = useState("");
  const [then, setThen] = useState("");
  const ref = useRef<HTMLFormElement>(null);
  const [seen, setSeen] = useState<number | undefined>(undefined);
  // A reply was sent: clear the box (updating state during render, no effect needed)
  if (s.at !== seen) { setSeen(s.at); if (s.at && !s.error) { setText(""); setThen(""); } }
  if (disabled) return <p className="border-t bg-gray-50 px-4 py-3 text-sm text-gray-500">This case is closed. Reopen it to reply.</p>;
  return (
    <form ref={ref} action={act} className="space-y-2 border-t bg-white p-4">
      <input type="hidden" name="case_id" value={caseId} />
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[`Hi ${firstName}, `, ...QUICK].map((q) => (
          <button key={q} type="button" onClick={() => setText((t) => (q.startsWith("Hi ") ? q + t : (t ? `${t} ${q}` : q)))}
            className="shrink-0 rounded-full bg-indigo-50 px-3 py-1 text-xs text-indigo-700 hover:bg-indigo-100">{q.length > 40 ? `${q.slice(0, 38)}…` : q}</button>
        ))}
      </div>
      <div className="flex items-end gap-2 rounded-xl border border-gray-300 p-2 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-100">
        <label htmlFor="staff-reply" className="sr-only">Reply to the customer</label>
        <textarea id="staff-reply" name="message" rows={3} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) ref.current?.requestSubmit(); }}
          placeholder="Write to the customer… (Ctrl/⌘ + Enter to send)" className="min-h-16 flex-1 resize-none bg-transparent px-2 py-1 text-sm outline-none" />
        <button disabled={pending || text.trim().length < 2} aria-label="Send reply" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40"><SendIcon className="h-4 w-4" /></button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
        <label className="flex items-center gap-2">After sending:
          <select name="then" value={then} onChange={(e) => setThen(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1 text-xs">
            <option value="">Keep working on it</option>
            <option value="waiting">Wait for the customer</option>
            <option value="resolved">Mark resolved</option>
          </select>
        </label>
        <span>The customer sees this straight away and gets a notification.</span>
      </div>
      <Msg s={s} />
    </form>
  );
}

export function NoteForm({ caseId }: { caseId: string }) {
  const [s, act, pending] = useActionState(addNote, empty);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (s.at && !s.error) ref.current?.reset(); }, [s.at, s.error]);
  return (
    <form ref={ref} action={act} className="space-y-2">
      <input type="hidden" name="case_id" value={caseId} />
      <textarea name="note" rows={2} maxLength={1000} placeholder="Only staff can see notes" aria-label="Internal note"
        className="w-full resize-none rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2 text-sm outline-none focus:border-amber-400" />
      <div className="flex items-center justify-between"><Msg s={s} />
        <button disabled={pending} className={`${btn} ml-auto bg-amber-500 text-white hover:bg-amber-600`}>Add note</button></div>
    </form>
  );
}

const NEXT: Record<string, { status: string; label: string }[]> = {
  requested: [{ status: "approved", label: "Approve" }, { status: "rejected", label: "Reject" }],
  approved: [{ status: "received", label: "Mark items received" }],
  received: [{ status: "completed", label: "Complete" }],
};

export function ReturnControls({ caseId, returnId, status, kind }: { caseId: string; returnId: string; status: string; kind: string }) {
  const [s, act, pending] = useActionState(updateReturn, empty);
  const next = NEXT[status];
  if (!next) return null;
  return (
    <form action={act} className="space-y-2 border-t pt-3">
      <input type="hidden" name="case_id" value={caseId} />
      <input type="hidden" name="return_id" value={returnId} />
      <input name="note" maxLength={300} placeholder={status === "requested" ? "Note to customer (needed if you reject)" : status === "received" && kind === "exchange" ? "e.g. Replacement tracking number" : "Note to customer (optional)"}
        className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm" />
      <div className="flex flex-wrap gap-2">
        {next.map((n) => (
          <button key={n.status} name="status" value={n.status} disabled={pending}
            className={`${btn} ${n.status === "rejected" ? "border border-red-200 bg-white text-red-700 hover:bg-red-50" : "bg-indigo-600 text-white hover:bg-indigo-700"}`}>{n.label}</button>
        ))}
      </div>
      <Msg s={s} />
    </form>
  );
}
