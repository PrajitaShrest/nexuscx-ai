"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actOnRequest } from "./actions";

const btn = "rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50";

// Ready-made notes, so asking for a change takes one click
const QUICK: Record<string, string[]> = {
  id_card: [
    "Your photo is too dark. Please upload a brighter photo against a plain, light wall.",
    "Your face is not clearly visible. Please upload a head-and-shoulders photo looking at the camera, without a hat or sunglasses.",
    "The name does not match our records. Please use your full legal name.",
  ],
  enrolment_letter: ["Please tell us the exact name of the organisation the letter is for (for example, the bank and branch)."],
  transcript: ["Please check your postal address: it needs a street, suburb, state and postcode."],
  parking_permit: ["The registration does not match the state you chose. Please check your number plate and state."],
  delivery_address: ["We could not find this street in that suburb. Please check the street address."],
};
const READY_LABEL: Record<string, [string, string]> = {
  id_card: ["Issue the digital card", "Card printed: ready to collect"],
  enrolment_letter: ["Issue the letter", "Letter printed: ready to collect"],
  transcript: ["Issue the transcript", "Transcript ready to collect"],
  parking_permit: ["Activate the permit", "Activate the permit"],
  delivery_address: ["Change the address on the order", "Change the address on the order"],
  credit_transfer: ["Approve the units to check", "Approve the units to check"],
};
const PHOTO_CHECKS = ["The face is clear and looking at the camera", "Plain, light background, no hat or sunglasses", "It matches the student's name and details"];

export default function StaffActions({ id, type, status, pickup, hasPhoto }: { id: string; type: string; status: string; pickup: boolean; hasPhoto: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"" | "need_info" | "reject">("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [checks, setChecks] = useState<boolean[]>(PHOTO_CHECKS.map(() => false));

  const run = (action: string, text = "") => start(async () => {
    setError("");
    const r = await actOnRequest(id, action, text);
    if (r.error) { setError(r.error); return; }
    setMode(""); setNote(""); router.refresh();
  });

  if (status === "ready") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-600">Waiting for the person to collect it. When they do, check their photo ID and mark it collected.</p>
        <button type="button" disabled={pending} onClick={() => run("collected")} className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`}>{pending ? "Saving…" : "Mark as collected"}</button>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      </div>
    );
  }
  if (!["submitted", "in_review"].includes(status)) return <p className="text-sm text-gray-500">Nothing to do: this request is finished.</p>;

  const photoOk = type !== "id_card" || !hasPhoto || checks.every(Boolean);
  const [labelDigital, labelPickup] = READY_LABEL[type] ?? ["Mark as done", "Ready to collect"];

  return (
    <div className="space-y-4">
      {status === "submitted" && (
        <button type="button" disabled={pending} onClick={() => run("start")} className={`${btn} w-full border bg-white text-gray-800 hover:bg-gray-50`}>
          I&apos;m working on this
        </button>
      )}

      {type === "id_card" && hasPhoto && (
        <fieldset className="space-y-2 rounded-lg border bg-gray-50 p-3">
          <legend className="px-1 text-xs font-semibold uppercase text-gray-500">Check the photo</legend>
          {PHOTO_CHECKS.map((c, i) => (
            <label key={c} className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={checks[i]} onChange={(e) => setChecks((p) => p.map((x, j) => (j === i ? e.target.checked : x)))} className="mt-0.5 h-4 w-4 accent-indigo-600" />{c}
            </label>
          ))}
        </fieldset>
      )}

      <button type="button" disabled={pending || !photoOk} onClick={() => run("ready")} className={`${btn} w-full bg-indigo-600 text-white hover:bg-indigo-700`}>
        {pending ? "Saving…" : pickup ? labelPickup : labelDigital}
      </button>
      {!photoOk && <p className="text-xs text-gray-500">Tick the three photo checks first.</p>}
      <p className="text-xs text-gray-500">The person is notified straight away{pickup ? ", with where to collect it" : ""}.</p>

      {type === "credit_transfer" && <p className="text-xs text-gray-500">The AI already approved the clear units. Compare the unit outlines for the ones marked &ldquo;Assessor checking&rdquo;.</p>}
      <div className="flex flex-wrap gap-2 border-t pt-3">
        {type !== "credit_transfer" && <button type="button" onClick={() => { setMode(mode === "need_info" ? "" : "need_info"); setNote(""); }} className={`${btn} border bg-white text-amber-800 hover:bg-amber-50`}>Ask for a change</button>}
        <button type="button" onClick={() => { setMode(mode === "reject" ? "" : "reject"); setNote(""); }} className={`${btn} border bg-white text-red-700 hover:bg-red-50`}>Reject</button>
      </div>

      {mode && (
        <div className="space-y-2">
          {mode === "need_info" && (QUICK[type] ?? []).map((q) => (
            <button key={q} type="button" onClick={() => setNote(q)} className="block w-full rounded-lg border border-dashed px-3 py-2 text-left text-xs text-gray-700 hover:border-amber-400 hover:bg-amber-50">{q}</button>
          ))}
          <label htmlFor="staff-note" className="block text-sm font-medium">{mode === "need_info" ? "What needs changing? (the person sees this)" : "Reason (the person sees this)"}</label>
          <textarea id="staff-note" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm" />
          <button type="button" disabled={pending || note.trim().length < 10} onClick={() => run(mode, note)}
            className={`${btn} ${mode === "need_info" ? "bg-amber-600 hover:bg-amber-700" : "bg-red-600 hover:bg-red-700"} text-white`}>
            {pending ? "Sending…" : mode === "need_info" ? "Send back for changes" : "Reject request"}
          </button>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
