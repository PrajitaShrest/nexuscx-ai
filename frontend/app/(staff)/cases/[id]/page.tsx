import Link from "next/link";
import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import NoAccess from "@/components/NoAccess";
import { CATEGORY, STATUS, Pill, initials } from "@/components/Badges";
import { OrderPill, RETURN_REASONS, ReturnPill, ReturnSteps } from "@/components/ShopUI";
import { BotIcon, HeadsetIcon, ShieldIcon } from "@/components/Icons";
import { can, getMe } from "@/lib/data/me";
import { getCaseDetail, signPhotos } from "@/lib/data/workspace";
import PhotoStrip from "@/components/PhotoStrip";
import LiveRefresh from "@/components/LiveRefresh";
import { dayTime, money } from "@/lib/format";
import { displayMobile } from "@/lib/auth/phone";
import { Composer, NoteForm, ReturnControls, StatusBar } from "./CaseControls";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Case" };

function Box({ title, children, tone }: { title: string; children: React.ReactNode; tone?: string }) {
  return (
    <section className={`rounded-xl border bg-white p-4 ${tone ?? ""}`}>
      <h2 className="mb-3 text-sm font-semibold text-gray-900">{title}</h2>
      {children}
    </section>
  );
}

function slaText(due: string | null, status: string) {
  if (!due || ["resolved", "closed"].includes(status)) return { text: "—", late: false };
  const mins = Math.round((new Date(due).getTime() - Date.now()) / 60000);
  if (mins < 0) return { text: `${Math.abs(Math.round(mins / 60))}h overdue`, late: true };
  return { text: mins < 60 ? `${mins} min left` : `${Math.round(mins / 60)}h left`, late: mins < 60 };
}

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const me = await getMe();
  if (!can(me, "view_cases")) return <NoAccess me={me} page="Cases" needs="view_cases" />;
  const { id } = await params;
  const c = await getCaseDetail(id);
  if (!c) notFound();
  const photoUrls = await signPhotos(c.returns.flatMap((r) => r.photos ?? []));
  const canEdit = can(me, "resolve_cases");
  const active = c.assignments.find((a) => a.status === "active");
  const mine = active?.user?.user_id === me.user_id;
  const customerName = c.customer?.user?.name ?? "Customer";
  const sla = slaText(c.sla_due_at, c.status);
  const conf = c.confidence !== null ? Math.round(Number(c.confidence) * 100) : null;

  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-gray-50 text-gray-900">
      <Sidebar me={me} active="/cases" />
      <main className="min-w-0 flex-1 space-y-4 p-6">
        <div>
          <Link href="/cases" className="text-sm text-indigo-600 hover:underline">← Case queue</Link>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold">{c.case_number}<Pill map={STATUS} value={c.status} /><Pill map={CATEGORY} value={c.intent} /></h1>
              <p className="mt-1 max-w-3xl text-gray-600">{c.subject}</p>
              <p className="mt-1 text-sm text-gray-500">
                Opened {dayTime(c.created_at)} · Priority <span className="capitalize">{c.priority}</span> ·
                SLA <span className={sla.late ? "font-semibold text-red-600" : ""}>{sla.text}</span> ·
                {active?.user ? <> With <span className="font-medium text-gray-900">{mine ? "you" : active.user.name}</span></> : c.status === "escalated" ? " Waiting in the human queue" : c.agent ? ` Handled by ${c.agent.name}` : " Unassigned"}
              </p>
            </div>
          </div>
          <div className="mt-3"><StatusBar caseId={c.case_id} status={c.status} mine={mine} canEdit={canEdit} /></div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {/* Conversation */}
          <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border bg-white xl:sticky xl:top-4 xl:col-span-2 xl:self-start">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-sm font-semibold">Conversation with {customerName}</h2>
              <span className="flex items-center gap-3 text-xs text-gray-500">{c.messages.length} messages
                <LiveRefresh name={`case-${c.case_id}`} watch={[
                  ...(c.conversation_ids.length ? [{ table: "messages", event: "INSERT" as const, filter: `conversation_id=in.(${c.conversation_ids.join(",")})` }] : []),
                  { table: "cases", event: "UPDATE", filter: `case_id=eq.${c.case_id}` },
                  { table: "return_requests", filter: `case_id=eq.${c.case_id}` },
                ]} />
              </span>
            </div>
            <div className="max-h-[60vh] min-h-64 flex-1 space-y-4 overflow-y-auto bg-gray-50 p-4">
              {c.messages.map((m) => {
                if (m.sender_type === "system") {
                  return (
                    <div key={m.message_id} className="mx-auto flex max-w-lg items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      <ShieldIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>{m.content} <span className="text-amber-700">· {dayTime(m.sent_at)}</span></span>
                    </div>
                  );
                }
                const fromCustomer = m.sender_type === "customer";
                const human = m.sender_type === "human_agent";
                return (
                  <div key={m.message_id} className={`flex gap-2.5 ${fromCustomer ? "" : "flex-row-reverse"}`}>
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${fromCustomer ? "bg-slate-500" : human ? "bg-sky-600" : "bg-indigo-500"}`}>
                      {fromCustomer ? initials(customerName) : human ? <HeadsetIcon className="h-4 w-4" /> : <BotIcon className="h-4 w-4" />}
                    </span>
                    <div className={`max-w-[75%] ${fromCustomer ? "" : "text-right"}`}>
                      <div className={`inline-block rounded-2xl px-3.5 py-2.5 text-left text-sm ${fromCustomer ? "rounded-tl-sm border bg-white" : human ? "rounded-tr-sm bg-sky-600 text-white" : "rounded-tr-sm bg-indigo-50 text-indigo-950"}`}>{m.content}</div>
                      <p className="mt-1 text-[11px] text-gray-500">{fromCustomer ? customerName : human ? (m.sender_name ?? "Support team") : "AI assistant"} · {dayTime(m.sent_at)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            {canEdit && <Composer caseId={c.case_id} disabled={c.status === "closed"} firstName={customerName.split(" ")[0]} />}
          </section>

          {/* Context */}
          <aside className="min-w-0 space-y-4">
            <Box title="Customer">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-500 text-sm font-semibold text-white">{initials(customerName)}</span>
                <div className="min-w-0 text-sm">
                  <p className="font-medium">{customerName}</p>
                  <p className="truncate text-gray-500">{c.customer?.user?.email}</p>
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div><dt className="text-gray-500">Tier</dt><dd className="font-medium capitalize">{c.customer?.tier ?? "—"}</dd></div>
                <div><dt className="text-gray-500">Mobile</dt><dd className="font-medium">{c.customer?.phone ? displayMobile(c.customer.phone) : "—"}</dd></div>
                <div><dt className="text-gray-500">Orders</dt><dd className="font-medium">{c.order_count}</dd></div>
                <div><dt className="text-gray-500">Other cases</dt><dd className="font-medium">{c.other_cases.length}</dd></div>
              </dl>
              {c.other_cases.length > 0 && (
                <ul className="mt-3 space-y-1 border-t pt-2 text-xs">
                  {c.other_cases.map((o) => (
                    <li key={o.case_id}><Link href={`/cases/${o.case_id}`} className="flex justify-between gap-2 hover:text-indigo-700">
                      <span className="truncate">{o.case_number} · {o.subject}</span><Pill map={STATUS} value={o.status} /></Link></li>
                  ))}
                </ul>
              )}
            </Box>

            {c.returns.map((r) => (
              <Box key={r.return_id} title={`${r.kind === "exchange" ? "Exchange" : "Return"} ${r.return_number}`} tone="border-indigo-200">
                <div className="mb-2 flex items-center justify-between gap-2"><ReturnPill status={r.status} /><span className="text-xs text-gray-500">{RETURN_REASONS[r.reason]}</span></div>
                <ul className="space-y-1 text-sm">
                  {r.return_items.map((i) => <li key={i.return_item_id}>{i.quantity} × {i.product_name}{i.exchange_for && <span className="text-gray-500"> → {i.exchange_for}</span>}</li>)}
                </ul>
                {r.details && <p className="mt-2 rounded-md bg-gray-50 px-2 py-1.5 text-xs text-gray-600">“{r.details}”</p>}
                <PhotoStrip paths={r.photos} urls={photoUrls} />
                {r.kind === "return" && <p className="mt-2 text-xs text-gray-500">Refund due: <span className="font-semibold text-gray-900">{money(r.refund_cents)}</span></p>}
                <div className="mt-2"><ReturnSteps status={r.status} kind={r.kind} /></div>
                {canEdit && <div className="mt-3"><ReturnControls caseId={c.case_id} returnId={r.return_id} status={r.status} kind={r.kind} /></div>}
              </Box>
            ))}

            {c.order && (
              <Box title={`Order ${c.order.order_number}`}>
                <div className="mb-2 flex items-center justify-between"><OrderPill status={c.order.status} /><span className="text-sm font-semibold">{money(c.order.total_cents)}</span></div>
                <ul className="space-y-1 text-sm text-gray-700">{c.order.order_items.map((i) => <li key={i.order_item_id}>{i.quantity} × {i.product_name}</li>)}</ul>
                {c.order.tracking_number && <p className="mt-2 font-mono text-xs text-gray-500">Tracking {c.order.tracking_number}</p>}
                <Link href="/orders" className="mt-2 inline-block text-xs font-semibold text-indigo-700 hover:underline">Open in Orders →</Link>
              </Box>
            )}

            <Box title="AI analysis">
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <div><dt className="text-gray-500">Sentiment</dt><dd className="font-medium capitalize">{c.sentiment ?? "—"}</dd></div>
                <div><dt className="text-gray-500">Urgency</dt><dd className="font-medium capitalize">{c.urgency ?? "—"}</dd></div>
                <div><dt className="text-gray-500">Risk</dt><dd className={`font-medium capitalize ${c.risk === "high" || c.risk === "critical" ? "text-red-600" : ""}`}>{c.risk ?? "—"}</dd></div>
                <div><dt className="text-gray-500">Confidence</dt><dd className="font-medium">{conf !== null ? `${conf}%` : "—"}</dd></div>
              </dl>
              {c.escalations.length > 0 && (
                <p className="mt-3 rounded-md bg-red-50 px-2.5 py-2 text-xs text-red-800">Escalated because: <span className="font-semibold">{c.escalations.map((e) => e.reason).join(", ")}</span></p>
              )}
            </Box>

            <Box title="Internal notes" tone="border-amber-200">
              {canEdit && <NoteForm caseId={c.case_id} />}
              {c.notes.length === 0 ? <p className="mt-2 text-xs text-gray-500">No notes yet.</p> : (
                <ul className="mt-3 space-y-2">
                  {c.notes.map((n) => (
                    <li key={n.note_id} className="rounded-lg bg-amber-50 px-3 py-2 text-sm">
                      {n.content}<p className="mt-1 text-[11px] text-amber-800">{n.author?.name} · {dayTime(n.created_at)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Box>

            {c.assignments.length > 0 && (
              <Box title="Assignment history">
                <ul className="space-y-1 text-xs text-gray-600">
                  {c.assignments.map((a, i) => <li key={i}>{a.user?.name} · <span className="capitalize">{a.status}</span> · {dayTime(a.assigned_at)}</li>)}
                </ul>
              </Box>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
