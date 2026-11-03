"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { reply, type ReplyState } from "../actions";
import { RepeatIcon, SendIcon } from "@/components/Icons";
import { btnPrimary } from "@/components/ShopUI";
import { CHANGE_REQUEST } from "@/lib/orderChange";

// changeHref: set when the linked order's size or colour can still be changed by the AI.
// Then "change the size" opens that button straight away instead of waiting for a person.
export default function ReplyBox({ caseId, closed, changeHref = null }: { caseId: string; closed: boolean; changeHref?: string | null }) {
  const [state, action, pending] = useActionState<ReplyState, FormData>(reply, {});
  const [offer, setOffer] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.sent) form.current?.reset(); }, [state.sent]);

  if (closed) {
    return <p className="border-t bg-slate-50 px-5 py-4 text-sm text-muted">This conversation is closed. <Link href="/support" className="font-semibold text-indigo-700">Start a new chat</Link></p>;
  }
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const text = String(new FormData(e.currentTarget).get("message") ?? "");
    if (changeHref && CHANGE_REQUEST.test(text)) { e.preventDefault(); setOffer(true); form.current?.reset(); }
  };
  return (
    <form ref={form} action={action} onSubmit={onSubmit} className="border-t bg-white p-4">
      {offer && changeHref && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/60 px-4 py-3 text-sm">
          <span>You can change the size or colour yourself, straight away.</span>
          <Link href={changeHref} className={btnPrimary}><RepeatIcon className="h-4 w-4" /> Change size or colour</Link>
        </div>
      )}
      <input type="hidden" name="case_id" value={caseId} />
      <div className="flex items-end gap-2 rounded-2xl border border-slate-300 p-2 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-100">
        <label htmlFor="reply" className="sr-only">Your reply</label>
        <textarea id="reply" name="message" rows={2} maxLength={2000} placeholder="Add more details or reply to our team…"
          className="min-h-12 flex-1 resize-none bg-transparent px-2 py-1.5 text-[15px] outline-none" />
        <button disabled={pending} aria-label="Send reply" className={`${btnPrimary} h-11 w-11 shrink-0 px-0`}><SendIcon className="h-4 w-4" /></button>
      </div>
      <p className="mt-2 text-xs text-muted">Replies go to a person on our support team.</p>
      {state.error && <p role="alert" className="mt-2 text-sm text-bad">{state.error}</p>}
      {state.sent && !state.error && <p role="status" className="mt-2 text-sm text-ok">Sent. Our team will reply here.</p>}
    </form>
  );
}
