import Link from "next/link";
import { listMyReturns, signPhotos } from "@/lib/data/workspace";
import PhotoStrip from "@/components/PhotoStrip";
import { PageHead } from "@/components/CustomerShell";
import { EmptyState, RETURN_REASONS, ReturnPill, ReturnSteps, btnGhost, btnPrimary } from "@/components/ShopUI";
import { RepeatIcon } from "@/components/Icons";
import { day, money } from "@/lib/format";
import type { Metadata } from "next";
import { requireShop } from "@/lib/industry";

export const metadata: Metadata = { title: "Returns & exchanges" };

export default async function MyReturnsPage() {
  await requireShop("/support");
  const returns = await listMyReturns();
  const photoUrls = await signPhotos(returns.flatMap((r) => r.photos ?? []));
  return (
    <>
      <PageHead title="Returns & exchanges" sub="Free returns within 30 days of delivery. Start one from any delivered order."
        action={<Link href="/account/orders" className={btnPrimary}>Choose an order</Link>} />
      {returns.length === 0 ? (
        <EmptyState icon={<RepeatIcon className="h-6 w-6" />} title="No returns yet" text="To return or exchange something, open a delivered order and choose Return or exchange."
          action={<Link href="/account/orders" className={btnPrimary}>Go to my orders</Link>} />
      ) : (
        <ul className="space-y-4">
          {returns.map((r) => (
            <li key={r.return_id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold">{r.kind === "exchange" ? "Exchange" : "Return"} {r.return_number} <span className="font-normal text-muted">· order {r.order?.order_number}</span></p>
                  <p className="text-sm text-muted">Requested {day(r.created_at)} · {RETURN_REASONS[r.reason]}</p>
                </div>
                <ReturnPill status={r.status} />
              </div>
              <ul className="mt-3 space-y-1 text-sm">
                {r.return_items.map((i) => <li key={i.return_item_id}>{i.quantity} × {i.product_name}{i.exchange_for && <span className="text-muted"> → {i.exchange_for}</span>}</li>)}
              </ul>
              <PhotoStrip paths={r.photos} urls={photoUrls} size={56} />
              <div className="mt-4"><ReturnSteps status={r.status} kind={r.kind} /></div>
              {r.staff_note && <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-muted">Note from our team: {r.staff_note}</p>}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-sm">
                <span>{r.kind === "return" ? <>Refund: <span className="font-semibold">{money(r.refund_cents)}</span></> : "Replacement sent after we receive your items"}</span>
                <span className="flex gap-2">
                  <Link href={`/account/orders/${r.order_id}`} className={btnGhost}>View order</Link>
                  {r.case_id && <Link href={`/account/chats/${r.case_id}`} className={btnGhost}>Chat about this</Link>}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
