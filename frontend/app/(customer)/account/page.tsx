import Link from "next/link";
import { getMe } from "@/lib/data/me";
import { listAddresses, listMyChats, listMyOrders, oneLine } from "@/lib/data/shop";
import { listNotifications } from "@/lib/data/workspace";
import { ago, day, greeting, money } from "@/lib/format";
import { ArrowRightIcon, BellIcon, CartIcon, ChatIcon, ClockIcon, HeadsetIcon, MapPinIcon, PackageIcon, RepeatIcon, TruckIcon } from "@/components/Icons";
import { ChatPill, EmptyState, OrderPill, OrderTracker, Panel, ProductTile, btnGhost, btnPrimary } from "@/components/ShopUI";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "My account" };

// Customer home: what is happening with my orders and chats, in one place.
export default async function AccountHome() {
  const me = await getMe();
  const [orders, chats, addresses, notices] = await Promise.all([listMyOrders(), listMyChats(), listAddresses(), listNotifications(4)]);
  const first = me.name.split(" ")[0];
  const active = orders.filter((o) => ["placed", "processing", "shipped"].includes(o.status));
  const openChats = chats.filter((c) => !["resolved", "closed"].includes(c.status));
  const latest = active[0] ?? orders[0];
  const home = addresses.find((a) => a.is_default);

  const tiles = [
    { label: "Active orders", value: active.length, href: "/account/orders", icon: <TruckIcon className="h-5 w-5" />, tint: "bg-sky-50 text-sky-600" },
    { label: "Delivered", value: orders.filter((o) => o.status === "delivered").length, href: "/account/orders", icon: <PackageIcon className="h-5 w-5" />, tint: "bg-emerald-50 text-emerald-600" },
    { label: "Open chats", value: openChats.length, href: "/account/chats", icon: <ChatIcon className="h-5 w-5" />, tint: "bg-violet-50 text-violet-600" },
    { label: "Saved addresses", value: addresses.length, href: "/account/addresses", icon: <MapPinIcon className="h-5 w-5" />, tint: "bg-amber-50 text-amber-600" },
  ];
  const actions = [
    { label: "Shop products", text: "Browse and place an order", href: "/shop", icon: <CartIcon className="h-5 w-5" /> },
    { label: "Track an order", text: "See where your parcel is", href: "/account/orders", icon: <TruckIcon className="h-5 w-5" /> },
    { label: "Ask for help", text: "AI answers in seconds", href: "/support", icon: <HeadsetIcon className="h-5 w-5" /> },
    { label: "Return or exchange", text: "Free within 30 days", href: "/account/returns", icon: <RepeatIcon className="h-5 w-5" /> },
    { label: "Delivery addresses", text: "Add or edit an address", href: "/account/addresses", icon: <MapPinIcon className="h-5 w-5" /> },
  ];

  return (
    <>
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500 p-6 text-white shadow-lg shadow-indigo-200 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{greeting()}, {first}!</h1>
            <p className="mt-2 max-w-lg text-indigo-100">
              {active.length > 0 ? `You have ${active.length} order${active.length > 1 ? "s" : ""} on the way.` : "Everything is up to date."}
              {openChats.length > 0 ? ` ${openChats.length} help request${openChats.length > 1 ? "s are" : " is"} still open.` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/shop" className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 shadow-sm hover:bg-indigo-50">Start shopping</Link>
            <Link href="/support" className="rounded-xl bg-white/15 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/30 hover:bg-white/25">Get help</Link>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${t.tint}`}>{t.icon}</span>
            <p className="mt-3 text-2xl font-bold">{t.value}</p>
            <p className="text-sm text-muted">{t.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Panel title={latest && active.includes(latest) ? "Latest delivery" : "Latest order"}
            action={latest && <Link href={`/account/orders/${latest.order_id}`} className="text-sm font-semibold text-indigo-700 hover:underline">View order</Link>}>
            {latest ? (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{latest.order_number} <span className="font-normal text-muted">· {day(latest.created_at)}</span></p>
                    <p className="text-sm text-muted">{latest.order_items.map((i) => `${i.quantity} × ${i.product_name}`).join(", ")}</p>
                  </div>
                  <OrderPill status={latest.status} />
                </div>
                <OrderTracker status={latest.status} />
                {latest.tracking_number && latest.status === "shipped" && (
                  <p className="rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-800">Tracking number: <span className="font-mono font-semibold">{latest.tracking_number}</span></p>
                )}
              </div>
            ) : (
              <EmptyState icon={<CartIcon className="h-6 w-6" />} title="No orders yet" text="When you place an order, you can track it here."
                action={<Link href="/shop" className={btnPrimary}>Browse products</Link>} />
            )}
          </Panel>

          <Panel title="Recent orders" action={orders.length > 0 && <Link href="/account/orders" className="text-sm font-semibold text-indigo-700 hover:underline">See all</Link>}>
            {orders.length === 0 ? <p className="text-sm text-muted">Nothing here yet.</p> : (
              <ul className="divide-y divide-slate-100">
                {orders.slice(0, 4).map((o) => (
                  <li key={o.order_id}>
                    <Link href={`/account/orders/${o.order_id}`} className="flex items-center gap-3 py-3 hover:bg-slate-50/60">
                      <ProductTile category={o.order_items[0]?.category ?? "accessories"} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{o.order_items[0]?.product_name}{o.order_items.length > 1 ? ` + ${o.order_items.length - 1} more` : ""}</span>
                        <span className="block text-xs text-muted">{o.order_number} · {day(o.created_at)}</span>
                      </span>
                      <span className="hidden text-sm font-semibold sm:block">{money(o.total_cents)}</span>
                      <OrderPill status={o.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <aside className="min-w-0 space-y-6">
          <Panel title="Quick actions">
            <div className="grid grid-cols-1 gap-2">
              {actions.map((a) => (
                <Link key={a.label} href={a.href} className="group flex items-center gap-3 rounded-2xl border border-slate-200 p-3 transition hover:border-indigo-300 hover:bg-indigo-50/40">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">{a.icon}</span>
                  <span className="flex-1"><span className="block text-sm font-semibold">{a.label}</span><span className="block text-xs text-muted">{a.text}</span></span>
                  <ArrowRightIcon className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-indigo-600" />
                </Link>
              ))}
            </div>
          </Panel>

          <Panel title="Latest updates" action={<Link href="/account/notifications" className="text-sm font-semibold text-indigo-700 hover:underline">All</Link>}>
            {notices.length === 0 ? <p className="text-sm text-muted">No updates yet.</p> : (
              <ul className="space-y-2">
                {notices.map((n) => (
                  <li key={n.notification_id}>
                    <Link href={n.link ?? "/account/notifications"} className="flex items-start gap-2.5 rounded-xl p-2 hover:bg-slate-50">
                      <BellIcon className={`mt-0.5 h-4 w-4 shrink-0 ${n.read_at ? "text-slate-400" : "text-indigo-600"}`} />
                      <span className="min-w-0 flex-1"><span className={`block text-sm ${n.read_at ? "" : "font-semibold"}`}>{n.title}</span><span className="block text-xs text-muted">{ago(n.created_at)}</span></span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Recent chats" action={<Link href="/account/chats" className="text-sm font-semibold text-indigo-700 hover:underline">History</Link>}>
            {chats.length === 0 ? (
              <p className="text-sm text-muted">No chats yet. <Link href="/support" className="font-semibold text-indigo-700">Ask a question</Link></p>
            ) : (
              <ul className="space-y-3">
                {chats.slice(0, 3).map((c) => (
                  <li key={c.case_id}>
                    <Link href={`/account/chats/${c.case_id}`} className="block rounded-2xl border border-slate-200 p-3 hover:border-indigo-300">
                      <span className="flex items-start justify-between gap-2">
                        <span className="line-clamp-1 text-sm font-semibold">{c.subject ?? "Support request"}</span>
                        <ChatPill status={c.status} />
                      </span>
                      <span className="mt-1 flex items-center gap-1 text-xs text-muted"><ClockIcon className="h-3 w-3" />{c.case_number} · {ago(c.updated_at)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Delivery address" action={<Link href="/account/addresses" className="text-sm font-semibold text-indigo-700 hover:underline">{home ? "Edit" : "Add"}</Link>}>
            {home ? (
              <div className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><MapPinIcon className="h-5 w-5" /></span>
                <div className="text-sm">
                  <p className="font-semibold">{home.recipient} <span className="ml-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">{home.label}</span></p>
                  <p className="text-muted">{oneLine(home)}</p>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted">
                <p>Add a delivery address so checkout is one click.</p>
                <Link href="/account/addresses" className={`${btnGhost} mt-3`}>Add an address</Link>
              </div>
            )}
          </Panel>
        </aside>
      </div>
    </>
  );
}
