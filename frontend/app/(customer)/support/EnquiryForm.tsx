"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { EnquiryResult } from "@/lib/data/cases";
import { sendEnquiry } from "./actions";
import { TOPICS, CUSTOMER_STATUS, topicForIntent } from "./topics";
import { BookIcon, BotIcon, CheckIcon, ChevronIcon, HeadsetIcon, SendIcon, ShieldIcon } from "@/components/Icons";

type Turn = { text: string; result: EnquiryResult };
type ChatState = { turns: Turn[]; error?: string; failed?: string };
const MAX = 2000;
const MOOD: Record<string, string> = { positive: "Happy", neutral: "Calm", negative: "Unhappy", angry: "Upset" };

function BotAvatar() {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
      <BotIcon className="h-5 w-5" />
    </div>
  );
}

// Received -> Understood -> Answered / With a specialist -> Resolved
function Tracker({ r }: { r: EnquiryResult }) {
  const human = r.status !== "ai_handling";
  const steps = human
    ? [["Received", true], ["Understood", true], ["With a specialist", "now"], ["Resolved", false]]
    : [["Received", true], ["Understood", true], ["Answered", true]];
  return (
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-2 text-xs" aria-label="Request progress">
      {steps.map(([label, done], i) => (
        <li key={String(label)} className="flex items-center gap-1">
          {i > 0 && <span className={`h-px w-4 ${done ? "bg-indigo-300" : "bg-slate-200"}`} />}
          <span className={`flex h-5 w-5 items-center justify-center rounded-full ${
            done === true ? "bg-indigo-600 text-white" : done === "now" ? "bg-amber-400 text-white ring-4 ring-amber-100" : "bg-slate-200 text-slate-400"}`}>
            {done === true ? <CheckIcon className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
          </span>
          <span className={done ? "font-medium text-ink" : "text-muted"}>{label}</span>
        </li>
      ))}
    </ol>
  );
}

function Reply({ text, result: r }: Turn) {
  const status = CUSTOMER_STATUS[r.status] ?? CUSTOMER_STATUS.ai_handling;
  const topic = topicForIntent(r.intent);
  const conf = Math.round(Number(r.confidence) * 100);
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-3 text-[15px] text-white shadow-sm">{text}</div>
      </div>
      <div className="flex gap-3">
        <BotAvatar />
        <div className="max-w-[85%] space-y-3">
          <div className="rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 text-[15px] text-ink shadow-sm">
            {r.reply}
            {r.source && (
              <p className="mt-3 flex items-center gap-1.5 border-t pt-2 text-xs text-muted">
                <BookIcon className="h-3.5 w-3.5" /> Source: {r.source}
              </p>
            )}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted">Case {r.case_number}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${status.style}`}>{status.label}</span>
            </div>
            <Tracker r={r} />
            <details className="group mt-3 text-xs">
              <summary className="flex cursor-pointer list-none items-center gap-1 font-medium text-indigo-700">
                How our AI understood this <ChevronIcon className="h-3.5 w-3.5 transition group-open:rotate-180" />
              </summary>
              <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[["Topic", topic.label], ["Mood", MOOD[r.sentiment] ?? r.sentiment], ["Urgency", r.urgency], ["Handled by", r.routed_to]].map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-white px-2.5 py-1.5 ring-1 ring-slate-200">
                    <dt className="text-muted">{k}</dt><dd className="font-semibold capitalize text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-muted">Confidence</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                  <span className="block h-full rounded-full bg-indigo-500" style={{ width: `${conf}%` }} />
                </span>
                <span className="font-semibold">{conf}%</span>
              </div>
              {r.escalation_rule && (
                <p className="mt-2 flex items-center gap-1.5 text-amber-800">
                  <ShieldIcon className="h-3.5 w-3.5" /> Passed to a person because: {r.escalation_rule}
                </p>
              )}
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EnquiryForm({ firstName }: { firstName: string }) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState("");
  const [topicId, setTopicId] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const [chat, action, pending] = useActionState<ChatState, FormData>(async (prev, fd) => {
    const r = await sendEnquiry({}, fd);
    if (r.result) {
      setDraft("");
      return { turns: [...prev.turns, { text: r.message ?? "", result: r.result }] };
    }
    return { ...prev, error: r.error ?? "Something went wrong. Please try again." };
  }, { turns: [] });

  useEffect(() => {
    if (chat.turns.length === 0 && !pending) return; // stay at the top on first load
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [chat.turns.length, pending]);

  const topic = TOPICS.find((t) => t.id === topicId);
  const pick = (q: string) => { setDraft(q); boxRef.current?.focus(); };
  const askHuman = () => { setDraft("I would like to speak to a real person, please."); setTimeout(() => formRef.current?.requestSubmit(), 0); };
  const empty = chat.turns.length === 0 && !pending;

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-indigo-100/60">
      {/* Chat header */}
      <div className="flex items-center gap-3 border-b bg-gradient-to-r from-indigo-50 via-white to-violet-50 px-5 py-4">
        <BotAvatar />
        <div className="flex-1">
          <p className="font-semibold text-ink">NexusCX Assistant</p>
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <span className="h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-100" /> Online · usually replies in seconds
          </p>
        </div>
        <button type="button" onClick={askHuman} disabled={pending}
          className="flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-ink hover:border-indigo-400 hover:text-indigo-700 disabled:opacity-50">
          <HeadsetIcon className="h-4 w-4" /> <span className="hidden sm:inline">Talk to a person</span>
        </button>
      </div>

      {/* Conversation */}
      <div className="max-h-[560px] min-h-[320px] space-y-6 overflow-y-auto bg-[radial-gradient(circle_at_top_right,#eef2ff,transparent_45%)] px-5 py-6">
        <div className="flex gap-3">
          <BotAvatar />
          <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 text-[15px] text-ink shadow-sm">
            Hi {firstName}! I&apos;m your NexusCX assistant. Pick a topic below or just type your question.
            If anything needs a person, I&apos;ll pass it to our team straight away.
          </div>
        </div>

        {empty && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {TOPICS.map((t) => (
              <button key={t.id} type="button" onClick={() => setTopicId(t.id === topicId ? null : t.id)} aria-pressed={t.id === topicId}
                className={`group rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${
                  t.id === topicId ? "border-indigo-400 bg-indigo-50/60 ring-2 ring-indigo-200" : "border-slate-200 bg-white"}`}>
                <span className={`mb-3 flex h-11 w-11 items-center justify-center rounded-xl ring-1 ${t.tint}`}>{t.icon}</span>
                <span className="block font-semibold text-ink">{t.label}</span>
                <span className="mt-0.5 block text-xs text-muted">{t.blurb}</span>
              </button>
            ))}
          </div>
        )}

        {chat.turns.map((t) => <Reply key={t.result.case_number} {...t} />)}

        {pending && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-br-md bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-3 text-[15px] text-white opacity-80">{sending}</div>
            </div>
            <div className="flex items-center gap-3">
              <BotAvatar />
              <div className="flex gap-1 rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-4" aria-label="Assistant is typing">
                <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Suggestions + composer */}
      <div className="border-t bg-white px-5 py-4">
        {!empty && (
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
            {TOPICS.map((t) => (
              <button key={t.id} type="button" onClick={() => setTopicId(t.id === topicId ? null : t.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${
                  t.id === topicId ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-slate-200 text-muted hover:bg-slate-50"}`}>
                <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{t.icon}</span>{t.label}
              </button>
            ))}
          </div>
        )}
        {topic && (
          <div className="mb-3 flex flex-wrap gap-2">
            {topic.questions.map((q) => (
              <button key={q} type="button" onClick={() => pick(q)}
                className="rounded-full bg-indigo-50 px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-100">{q}</button>
            ))}
          </div>
        )}
        <form ref={formRef} action={action} onSubmit={() => setSending(draft.trim())}>
          <div className="flex items-end gap-2 rounded-2xl border border-slate-300 bg-white p-2 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-100">
            <label htmlFor="message" className="sr-only">Your message</label>
            <textarea id="message" ref={boxRef} name="message" rows={2} maxLength={MAX} value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (draft.trim().length >= 5 && !pending) formRef.current?.requestSubmit(); }
              }}
              placeholder="Describe your issue… (Enter to send, Shift+Enter for a new line)"
              className="max-h-40 min-h-12 flex-1 resize-none bg-transparent px-2 py-1.5 text-[15px] text-ink outline-none placeholder:text-slate-400" />
            <button disabled={pending || draft.trim().length < 5} aria-label="Send message"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-md transition hover:brightness-110 disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none">
              <SendIcon className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-muted">
            <span className="flex items-center gap-1.5"><ShieldIcon className="h-3.5 w-3.5" /> AI-assisted · a person is always available</span>
            <span className={draft.length > MAX * 0.9 ? "text-bad" : ""}>{draft.length}/{MAX}</span>
          </div>
          {chat.error && !pending && (
            <p role="alert" className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-bad">{chat.error}</p>
          )}
        </form>
      </div>
    </div>
  );
}
