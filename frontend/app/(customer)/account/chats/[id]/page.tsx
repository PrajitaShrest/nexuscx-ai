import Link from "next/link";
import { notFound } from "next/navigation";
import { getChat } from "@/lib/data/shop";
import { dayTime, day } from "@/lib/format";
import { ChatPill } from "@/components/ShopUI";
import { BotIcon, HeadsetIcon, PackageIcon, RepeatIcon, ShieldIcon } from "@/components/Icons";
import { CHANGE_REQUEST, canChangeOrder } from "@/lib/orderChange";
import ReplyBox from "./ReplyBox";
import ScrollToEnd from "@/components/ScrollToEnd";
import LiveRefresh from "@/components/LiveRefresh";
import RateChat from "./RateChat";
import { getMyRating } from "@/lib/data/workspace";
import { getPack } from "@/lib/industry";
import { getRequestForms } from "@/lib/data/requests";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Chat" };

// The AI's answer to "can I change the size?" when the order can still be changed
function ChangeCard({ href }: { href: string }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white"><BotIcon className="h-5 w-5" /></span>
      <div className="max-w-[80%] space-y-3 rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 text-[15px] shadow-sm">
        <p>Good news: this order hasn&apos;t shipped yet, so you can change the size or colour yourself, straight away. No need to wait for our team.</p>
        <Link href={href} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-110">
          <RepeatIcon className="h-4 w-4" /> Change size or colour
        </Link>
        <p className="text-xs text-muted">Free, and your delivery date stays the same.</p>
      </div>
    </div>
  );
}

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [chat, pack, { types: forms }] = await Promise.all([getChat(id), getPack(), getRequestForms()]);
  if (!chat) notFound();
  const done = ["resolved", "closed"].includes(chat.status);
  const rated = done ? await getMyRating(chat.case_id) : null;
  const title = chat.subject?.replace(/^About my order [A-Z0-9-]+: /, "") ?? "Support request";
  // Size or colour change the AI can do itself: offer the button instead of waiting for a person
  // eslint-disable-next-line react-hooks/purity -- server component, rendered once per request
  const changeHref = pack.shop && chat.order && chat.orderInfo && canChangeOrder(chat.orderInfo, Date.now()) ? `/account/orders/${chat.order.order_id}?change=1` : null;
  const askedChange = !!changeHref && !done && chat.messages.some((m) => m.sender_type === "customer" && CHANGE_REQUEST.test(m.content));

  return (
    <>
      <div>
        <Link href="/account/chats" className="text-sm font-medium text-indigo-700 hover:underline">← Chat history</Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              <span>{chat.case_number}</span><span>Started {day(chat.created_at)}</span>
              {chat.order && (
                <Link href={`/account/orders/${chat.order.order_id}`} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700">
                  <PackageIcon className="h-3.5 w-3.5" /> Order {chat.order.order_number}
                </Link>
              )}
            </p>
          </div>
          <span className="flex items-center gap-3">
            <LiveRefresh name={`chat-${chat.case_id}`} watch={[
              ...(chat.conversation_ids.length ? [{ table: "messages", event: "INSERT" as const, filter: `conversation_id=in.(${chat.conversation_ids.join(",")})` }] : []),
              { table: "cases", event: "UPDATE", filter: `case_id=eq.${chat.case_id}` },
            ]} />
            <ChatPill status={chat.status} />
          </span>
        </div>
      </div>

      {done && <RateChat caseId={chat.case_id} rated={rated} />}

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="max-h-[60vh] space-y-4 overflow-y-auto bg-[radial-gradient(circle_at_top_right,#eef2fd,transparent_45%)] p-5">
          {chat.messages.map((m) => {
            if (m.sender_type === "customer") {
              return (
                <div key={m.message_id} className="flex flex-col items-end">
                  <div className="max-w-[80%] rounded-2xl rounded-br-md bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-3 text-[15px] text-white shadow-sm">{m.content}</div>
                  <span className="mt-1 text-xs text-muted">You · {dayTime(m.sent_at)}</span>
                </div>
              );
            }
            if (m.sender_type === "system") {
              return (
                <div key={m.message_id} className="mx-auto flex max-w-xl items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <ShieldIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{m.content}<span className="mt-1 block text-xs text-amber-700">{dayTime(m.sent_at)}</span></span>
                </div>
              );
            }
            const human = m.sender_type === "human_agent";
            return (
              <div key={m.message_id} className="flex gap-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white ${human ? "bg-sky-600" : "bg-gradient-to-br from-indigo-500 to-violet-600"}`}>
                  {human ? <HeadsetIcon className="h-5 w-5" /> : <BotIcon className="h-5 w-5" />}
                </span>
                <div className="max-w-[80%]">
                  <div className="whitespace-pre-line rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 text-[15px] shadow-sm">{m.content}</div>
                  <span className="mt-1 block text-xs text-muted">{human ? (pack.shop ? "Support team" : `${pack.org} staff`) : pack.assistant} · {dayTime(m.sent_at)}</span>
                </div>
              </div>
            );
          })}
          {askedChange && changeHref && <ChangeCard href={changeHref} />}
          <ScrollToEnd count={chat.messages.length} />
        </div>
        <ReplyBox caseId={chat.case_id} closed={chat.status === "closed"} changeHref={changeHref} forms={forms} withPerson={["escalated", "human_handling", "waiting"].includes(chat.status)} />
      </section>
    </>
  );
}
