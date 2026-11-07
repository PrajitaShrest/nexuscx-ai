"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import type { EnquiryResult } from "@/lib/data/cases";
import { sendEnquiry, sendFeedback } from "./actions";
import { TOPIC_SETS } from "./topics";
import OrderChange from "./OrderChange";
import { CHANGE_REQUEST } from "@/lib/orderChange";
import RequestForm from "@/components/requests/RequestForm";
import { formForMessage, hoursText, type Prefill, type RequestType } from "@/lib/forms";
import { PACKS, type Industry } from "@/lib/packs";
import { BookIcon, BotIcon, HeadsetIcon, SendIcon, ShieldIcon } from "@/components/Icons";

type Turn = { text: string; result: EnquiryResult; change?: boolean; form?: RequestType };
type ChatState = { turns: Turn[]; error?: string; failed?: string };
const MAX = 2000;

function BotAvatar() {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
      <BotIcon className="h-5 w-5" />
    </div>
  );
}

// "Did this help?" under an AI answer: yes closes it, no passes it to a person
function Helpful({ caseId }: { caseId: string }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState<{ helpful: boolean; text: string } | null>(null);
  const [error, setError] = useState("");
  const send = (helpful: boolean) => start(async () => {
    const r = await sendFeedback(caseId, helpful);
    if (r.error) { setError(r.error); return; }
    setDone({ helpful, text: helpful ? "Great, glad that helped. We've closed this request." : r.reply ?? "Thanks. A person will reply here soon." });
  });
  if (done) {
    return <p className={`rounded-xl px-3 py-2 text-sm ${done.helpful ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>{done.text}</p>;
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm" aria-busy={pending}>
      <span className="text-muted">Did this answer your question?</span>
      <button type="button" onClick={() => send(true)} disabled={pending}
        className="rounded-full border border-emerald-300 bg-white px-3 py-1 font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">👍 Yes, thanks</button>
      <button type="button" onClick={() => send(false)} disabled={pending}
        className="rounded-full border border-slate-300 bg-white px-3 py-1 font-medium text-ink hover:bg-slate-50 disabled:opacity-50">👎 No, I need a person</button>
      {error && <span role="alert" className="text-bad">{error}</span>}
    </div>
  );
}

// The AI is unsure: it asks which topic the person means instead of passing it to a person
function Clarify({ text, result: r, onChoose }: Turn & { onChoose: (title: string | null) => void }) {
  const [chosen, setChosen] = useState<string | null | undefined>(undefined);
  const choose = (t: string | null) => { setChosen(t); onChoose(t); };
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-3 text-[15px] text-white shadow-sm">{text}</div>
      </div>
      <div className="flex gap-3">
        <BotAvatar />
        <div className="max-w-[85%] space-y-3 rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 text-[15px] text-ink shadow-sm">
          <p>{r.reply}</p>
          <div className="flex flex-col gap-2">
            {(r.options ?? []).map((o) => (
              <button key={o.title} type="button" disabled={chosen !== undefined} onClick={() => choose(o.title)}
                className={`rounded-xl border px-3 py-2 text-left text-sm font-medium transition ${chosen === o.title ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50"} disabled:cursor-default`}>
                {o.title}
              </button>
            ))}
            <button type="button" disabled={chosen !== undefined} onClick={() => choose(null)}
              className={`rounded-xl border border-dashed px-3 py-2 text-left text-sm transition ${chosen === null ? "border-amber-400 bg-amber-50 text-amber-800" : "border-slate-300 text-muted hover:bg-slate-50"} disabled:cursor-default`}>
              None of these: talk to a person
            </button>
          </div>
          <p className="text-xs text-muted">Asking first means you get an answer straight away more often.</p>
        </div>
      </div>
    </div>
  );
}

// The AI recognised a request with a form: it explains, then shows the form already filled in
function FormTurn({ text, type, prefill }: { text: string; type: RequestType; prefill: Prefill }) {
  const photo = type.fields.some((f) => f.type === "photo");
  const auto = type.fields.filter((f) => f.prefill && (prefill[f.prefill] ?? "") !== "").length;
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-3 text-[15px] text-white shadow-sm">{text}</div>
      </div>
      <div className="flex gap-3">
        <BotAvatar />
        <div className="min-w-0 max-w-[92%] flex-1 space-y-3 rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 text-[15px] text-ink shadow-sm">
          {type.type_key === "credit_transfer" ? (
            <p>Good news: I can check your credit <strong>straight away</strong>. Add the units you passed before (or paste them from your transcript) and I&apos;ll show which Northbridge units you can skip, and when you could finish. Recognised units are approved instantly.</p>
          ) : <p>I can sort out your <strong>{type.title.toLowerCase()}</strong> right here. {auto > 0 ? `I've already filled in ${auto} detail${auto === 1 ? "" : "s"} from your account. ` : ""}
            Just check {auto > 0 ? "them" : "the form"}{photo ? ", add a photo" : ""} and send. It goes straight to the {type.team_name} team, who usually finish these {hoursText(type.sla_hours)}.</p>}
          {type.type_key === "credit_transfer" ? (
            <a href="/account/credit" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:brightness-110">
              Check my credit now →
            </a>
          ) : <RequestForm type={type} prefill={prefill} compact />}
        </div>
      </div>
    </div>
  );
}

function Reply({ text, result: r }: Turn) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-3 text-[15px] text-white shadow-sm">{text}</div>
      </div>
      <div className="flex gap-3">
        <BotAvatar />
        <div className="max-w-[85%] space-y-3">
          <div className="whitespace-pre-line rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 text-[15px] text-ink shadow-sm">
            {r.reply}
            {r.source && (
              <p className="mt-3 flex items-center gap-1.5 border-t pt-2 text-xs text-muted">
                <BookIcon className="h-3.5 w-3.5" /> Source: {r.source}
              </p>
            )}
          </div>
          {r.status === "ai_handling" && r.case_id && <Helpful caseId={r.case_id} />}
          {r.status === "escalated" && r.case_id && (
            // 031: a way to actually reach a person (urgent ones get "Call me now", never a booking form)
            ["Student Wellbeing", "Product Safety"].includes(r.department ?? "") ? (
              <a href={`/account/chats/${r.case_id}`} className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-rose-700">Talk to a person now →</a>
            ) : (
              <a href={`/account/chats/${r.case_id}`} className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50">Want to talk to a person? Ask for a call or book a time →</a>
            )
          )}
        </div>
      </div>
    </div>
  );
}

export default function EnquiryForm({ firstName, industry, forms }: { firstName: string; industry: Industry; forms?: { types: RequestType[]; prefill: Prefill } }) {
  const TOPICS = TOPIC_SETS[industry];
  const pack = PACKS[industry];
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState("");
  const [topicId, setTopicId] = useState<string | null>(null);
  const [clarified, setClarified] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const [chat, action, pending] = useActionState<ChatState, FormData>(async (prev, fd) => {
    // Store: "change the size/colour" is done by the Orders Agent itself, step by step in the chat
    const text = String(fd.get("message") ?? "").trim();
    if (pack.shop && CHANGE_REQUEST.test(text)) {
      setDraft("");
      return { turns: [...prev.turns, { text, result: { status: "order_change" } as unknown as EnquiryResult, change: true }] };
    }
    // A request that has a form (ID card, letter, permit, address change): the AI offers the form here
    const form = forms && !fd.get("clarified") ? formForMessage(forms.types, text) : null;
    if (form) {
      setDraft("");
      return { turns: [...prev.turns, { text, result: { status: "form" } as unknown as EnquiryResult, form }] };
    }
    const r = await sendEnquiry({}, fd);
    if (r.result) {
      setDraft("");
      setClarified(false);
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
  // A topic was picked after "Is your question about one of these?": send it, and do not ask again
  const choose = (original: string, title: string | null) => {
    setClarified(true);
    setDraft(title ? `${original} (about: ${title})` : `${original}. None of those topics, I would like to speak to someone.`);
    setTimeout(() => formRef.current?.requestSubmit(), 0);
  };
  const askHuman = () => { setDraft("I would like to speak to a real person, please."); setTimeout(() => formRef.current?.requestSubmit(), 0); };
  const empty = chat.turns.length === 0 && !pending;

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-indigo-100/60">
      {/* Chat header */}
      <div className="flex items-center gap-3 border-b bg-gradient-to-r from-indigo-50 via-white to-violet-50 px-5 py-4">
        <BotAvatar />
        <div className="flex-1">
          <p className="font-semibold text-ink">{pack.assistant}</p>
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
      <div className="max-h-[560px] min-h-[320px] space-y-6 overflow-y-auto bg-[radial-gradient(circle_at_top_right,#eef2fd,transparent_45%)] px-5 py-6">
        <div className="flex gap-3">
          <BotAvatar />
          <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 text-[15px] text-ink shadow-sm">
            Hi {firstName}! I&apos;m the {pack.assistant}. Pick a topic below or just type your question, in any language.
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

        {chat.turns.map((t, i) => t.form && forms
          ? <FormTurn key={`f${i}`} text={t.text} type={t.form} prefill={forms.prefill} />
          : t.change
          ? <OrderChange key={`o${i}`} text={t.text} onHuman={askHuman} />
          : t.result.status === "clarify"
          ? <Clarify key={`c${i}`} {...t} onChoose={(title) => choose(t.text, title)} />
          : <Reply key={t.result.case_number ?? i} {...t} />)}

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
          <input type="hidden" name="clarified" value={clarified ? "1" : ""} />
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
