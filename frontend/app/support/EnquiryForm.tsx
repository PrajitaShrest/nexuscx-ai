"use client";

import { useActionState } from "react";
import { sendEnquiry, type EnquiryState } from "./actions";
import FormMessage from "@/components/FormMessage";

const TOPICS = ["Order & Delivery", "Billing & Payments", "Technical Support", "Account Help", "Something Else"];

export default function EnquiryForm() {
  const [state, action, pending] = useActionState<EnquiryState, FormData>(sendEnquiry, {});
  const r = state.result;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TOPICS.map((t) => <span key={t} className="rounded-full border bg-white px-3 py-1 text-xs text-gray-600">{t}</span>)}
      </div>

      {r && (
        <div className="space-y-3 rounded-lg border bg-white p-4">
          <div className="ml-auto max-w-md rounded-lg bg-indigo-600 p-3 text-sm text-white">{state.message}</div>
          <div className="rounded-md border border-indigo-100 bg-indigo-50 p-3 text-xs text-indigo-900">
            <p className="mb-1 font-semibold">AI Classification · {r.case_number}</p>
            <p>Intent: <b>{r.intent.replace("_", " ")}</b> · Sentiment: <b>{r.sentiment}</b> · Urgency: <b>{r.urgency}</b> · Risk: <b>{r.risk}</b> · Confidence: <b>{Math.round(Number(r.confidence) * 100)}%</b></p>
            <p>Orchestrator → <b>{r.routed_to}</b></p>
          </div>
          {r.escalation_rule && (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
              ⚠ Escalation rule: <b>{r.escalation_rule}</b> → human support
            </p>
          )}
          <div className="max-w-md rounded-lg bg-gray-100 p-3 text-sm text-gray-800">
            {r.reply}
            {r.source && <p className="mt-2 text-xs text-gray-500">[1] {r.source}</p>}
          </div>
        </div>
      )}

      <form action={action} className="space-y-2">
        <textarea name="message" rows={3} defaultValue={r ? "" : state.message} placeholder="Type your message…"
          className="w-full rounded-lg border bg-white p-3 text-sm text-gray-900" maxLength={2000} />
        <FormMessage error={state.error} />
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">AI-assisted · Human escalation always available</p>
          <button disabled={pending} className="rounded-md bg-indigo-600 px-5 py-2 text-sm font-medium text-white disabled:opacity-60">
            {pending ? "Sending…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
