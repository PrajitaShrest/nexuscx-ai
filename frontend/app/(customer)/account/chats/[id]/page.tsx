import Link from "next/link";
import { notFound } from "next/navigation";
import { getChat } from "@/lib/data/shop";
import { dayTime, day } from "@/lib/format";
import { ChatPill } from "@/components/ShopUI";
import { BotIcon, HeadsetIcon, PackageIcon, ShieldIcon } from "@/components/Icons";
import ReplyBox from "./ReplyBox";
import RateChat from "./RateChat";
import { getMyRating } from "@/lib/data/workspace";

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const chat = await getChat(id);
  if (!chat) notFound();
  const done = ["resolved", "closed"].includes(chat.status);
  const rated = done ? await getMyRating(chat.case_id) : null;
  const title = chat.subject?.replace(/^About my order [A-Z0-9-]+: /, "") ?? "Support request";

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
          <ChatPill status={chat.status} />
        </div>
      </div>

      {done && <RateChat caseId={chat.case_id} rated={rated} />}

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="max-h-[60vh] space-y-4 overflow-y-auto bg-[radial-gradient(circle_at_top_right,#eef2ff,transparent_45%)] p-5">
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
                  <div className="rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 text-[15px] shadow-sm">{m.content}</div>
                  <span className="mt-1 block text-xs text-muted">{human ? "Support team" : "NexusCX Assistant"} · {dayTime(m.sent_at)}</span>
                </div>
              </div>
            );
          })}
        </div>
        <ReplyBox caseId={chat.case_id} closed={chat.status === "closed"} />
      </section>
    </>
  );
}
