"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { reply, type ReplyState } from "../actions";
import { ArrowRightIcon, RepeatIcon, SendIcon } from "@/components/Icons";
import { btnPrimary } from "@/components/ShopUI";
import { CHANGE_REQUEST } from "@/lib/orderChange";
import { formForMessage, type RequestType } from "@/lib/forms";

// Reply in an existing chat.
// - Enter sends, Shift+Enter starts a new line.
// - The AI answers straight away when it safely can (migration 027); otherwise a person replies.
// - "Change the size" (changeHref) or a request that has a form (ID card, letter...) opens that
//   instead of waiting for a person.
export default function ReplyBox({ caseId, closed, changeHref = null, forms = [], withPerson = false }: {
  caseId: string; closed: boolean; changeHref?: string | null; forms?: RequestType[]; withPerson?: boolean;
}) {
  const [state, action, pending] = useActionState<ReplyState, FormData>(reply, {});
  const [offer, setOffer] = useState(false);
  const [form, setForm] = useState<RequestType | null>(null);
  const [text, setText] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const [lastSent, setLastSent] = useState(state.sent);
  if (state.sent !== lastSent) { setLastSent(state.sent); setText(""); }

  if (closed) {
    return <p className="border-t bg-slate-50 px-5 py-4 text-sm text-muted">This conversation is closed. <Link href="/support" className="font-semibold text-indigo-700">Start a new chat</Link></p>;
  }
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const msg = text.trim();
    if (msg.length < 2 || pending) { e.preventDefault(); return; }
    if (changeHref && CHANGE_REQUEST.test(msg)) { e.preventDefault(); setOffer(true); setForm(null); setText(""); return; }
    const f = formForMessage(forms, msg);
    if (f) { e.preventDefault(); setForm(f); setOffer(false); setText(""); }
  };
  return (
    <form ref={formRef} action={action} onSubmit={onSubmit} className="border-t bg-white p-4">
      {offer && changeHref && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/60 px-4 py-3 text-sm">
          <span>You can change the size or colour yourself, straight away.</span>
          <Link href={changeHref} className={btnPrimary}><RepeatIcon className="h-4 w-4" /> Change size or colour</Link>
        </div>
      )}
      {form && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/60 px-4 py-3 text-sm">
          <span>I can sort out your <strong>{form.title.toLowerCase()}</strong> now: a short form, already filled in with your details.</span>
          <Link href={`/account/requests/new?type=${form.type_key}`} className={btnPrimary}>Start the form <ArrowRightIcon className="h-4 w-4" /></Link>
        </div>
      )}
      <input type="hidden" name="case_id" value={caseId} />
      <div className="flex items-end gap-2 rounded-2xl border border-slate-300 p-2 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-100">
        <label htmlFor="reply" className="sr-only">Your message</label>
        <textarea id="reply" name="message" rows={2} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); formRef.current?.requestSubmit(); }
          }}
          placeholder="Ask a follow-up question… (Enter to send, Shift+Enter for a new line)"
          className="min-h-12 flex-1 resize-none bg-transparent px-2 py-1.5 text-[15px] outline-none" />
        <button disabled={pending || text.trim().length < 2} aria-label="Send" className={`${btnPrimary} h-11 w-11 shrink-0 px-0`}><SendIcon className="h-4 w-4" /></button>
      </div>
      <p className="mt-2 text-xs text-muted">
        {withPerson ? "A person from our team will reply here. The assistant still answers simple questions straight away." : "The assistant answers straight away when it can. Anything it can't answer goes to a person."}
      </p>
      {state.error && <p role="alert" className="mt-2 text-sm text-bad">{state.error}</p>}
      {state.sent && !state.error && (
        <p role="status" className="mt-2 text-sm text-ok">{state.answered ? "The assistant answered above." : "Sent. A person from our team will reply here."}</p>
      )}
    </form>
  );
}
