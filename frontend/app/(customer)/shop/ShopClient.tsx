"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import type { Address, Product } from "@/lib/data/shop";
import { money } from "@/lib/format";
import { CATEGORIES, EmptyState, ProductTile, btnPrimary } from "@/components/ShopUI";
import { CartIcon, MapPinIcon, MinusIcon, PlusIcon, SearchIcon, TrashIcon, TruckIcon } from "@/components/Icons";
import { checkout } from "./actions";

const FREE_FROM = 10000, DELIVERY = 995, MAX_QTY = 10;

export default function ShopClient({ products, addresses, initial, reordered }: {
  products: Product[]; addresses: Address[]; initial: Record<string, number>; reordered: string | null;
}) {
  const [cart, setCart] = useState<Record<string, number>>(initial);
  const [cat, setCat] = useState<string>("all");
  const [q, setQ] = useState("");
  const [addressId, setAddressId] = useState(addresses.find((a) => a.is_default)?.address_id ?? addresses[0]?.address_id ?? "");
  const [state, action, pending] = useActionState(checkout, {});

  const shown = useMemo(() => products.filter((p) =>
    (cat === "all" || p.category === cat) && `${p.name} ${p.description}`.toLowerCase().includes(q.trim().toLowerCase())), [products, cat, q]);
  const lines = products.filter((p) => cart[p.product_id]).map((p) => ({ p, qty: cart[p.product_id] }));
  const subtotal = lines.reduce((s, l) => s + l.p.price_cents * l.qty, 0);
  const delivery = subtotal === 0 || subtotal >= FREE_FROM ? 0 : DELIVERY;
  const count = lines.reduce((s, l) => s + l.qty, 0);

  const setQty = (p: Product, qty: number) => setCart((c) => {
    const next = { ...c };
    const capped = Math.max(0, Math.min(qty, p.stock, MAX_QTY));
    if (capped === 0) delete next[p.product_id]; else next[p.product_id] = capped;
    return next;
  });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="min-w-0 space-y-4 lg:col-span-2">
        {reordered && (
          <p role="status" className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
            We added the items from {reordered} to your cart. Check them and place your order.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative w-full sm:w-64">
            <span className="sr-only">Search products</span>
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products"
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" />
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[["all", "All"], ...Object.entries(CATEGORIES).map(([k, v]) => [k, v.label])].map(([k, label]) => (
              <button key={k} type="button" onClick={() => setCat(k)} aria-pressed={cat === k}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ${cat === k ? "bg-indigo-600 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {shown.length === 0 ? (
          <EmptyState icon={<SearchIcon className="h-6 w-6" />} title="No products match" text="Try another word or category." />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((p) => {
              const inCart = cart[p.product_id] ?? 0;
              return (
                <article key={p.product_id} className="flex flex-col rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
                  <ProductTile category={p.category} size="lg" />
                  <div className="mt-4 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">{CATEGORIES[p.category]?.label}</p>
                    <h3 className="mt-0.5 font-semibold text-ink">{p.name}</h3>
                    <p className="mt-1 text-sm text-muted">{p.description}</p>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-lg font-bold">{money(p.price_cents)}</span>
                    {p.stock === 0 ? <span className="text-xs font-semibold text-bad">Out of stock</span>
                      : p.stock <= 5 ? <span className="text-xs font-semibold text-amber-700">Only {p.stock} left</span>
                      : <span className="text-xs text-ok">In stock</span>}
                  </div>
                  {inCart === 0 ? (
                    <button type="button" disabled={p.stock === 0} onClick={() => setQty(p, 1)} className={`${btnPrimary} mt-3 w-full`}>
                      <CartIcon className="h-4 w-4" /> Add to cart
                    </button>
                  ) : (
                    <div className="mt-3 flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50 p-1">
                      <button type="button" onClick={() => setQty(p, inCart - 1)} aria-label={`One less ${p.name}`} className="flex h-9 w-9 items-center justify-center rounded-lg text-indigo-700 hover:bg-white"><MinusIcon className="h-4 w-4" /></button>
                      <span className="text-sm font-semibold text-indigo-800">{inCart} in cart</span>
                      <button type="button" onClick={() => setQty(p, inCart + 1)} disabled={inCart >= Math.min(p.stock, MAX_QTY)} aria-label={`One more ${p.name}`} className="flex h-9 w-9 items-center justify-center rounded-lg text-indigo-700 hover:bg-white disabled:opacity-40"><PlusIcon className="h-4 w-4" /></button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Cart and checkout */}
      <aside className="min-w-0">
        <form action={action} className="sticky top-20 space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold"><CartIcon className="h-5 w-5 text-indigo-600" /> Your cart</h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-muted">{count} item{count === 1 ? "" : "s"}</span>
          </div>

          {lines.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-muted">Your cart is empty. Add a product to get started.</p>
          ) : (
            <ul className="space-y-3">
              {lines.map(({ p, qty }) => (
                <li key={p.product_id} className="flex items-center gap-3">
                  <ProductTile category={p.category} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{p.name}</span>
                    <span className="block text-xs text-muted">{qty} × {money(p.price_cents)}</span>
                  </span>
                  <span className="text-sm font-semibold">{money(p.price_cents * qty)}</span>
                  <button type="button" onClick={() => setQty(p, 0)} aria-label={`Remove ${p.name}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-bad"><TrashIcon className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          )}

          {subtotal > 0 && subtotal < FREE_FROM && (
            <div className="rounded-2xl bg-sky-50 p-3 text-xs text-sky-800">
              <p className="flex items-center gap-1.5 font-medium"><TruckIcon className="h-4 w-4" /> Add {money(FREE_FROM - subtotal)} more for free delivery</p>
              <div className="mt-2 h-1.5 rounded-full bg-sky-100"><div className="h-full rounded-full bg-sky-500" style={{ width: `${Math.round((subtotal / FREE_FROM) * 100)}%` }} /></div>
            </div>
          )}

          <dl className="space-y-1.5 border-t pt-3 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{money(subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Delivery</dt><dd>{subtotal === 0 ? "—" : delivery === 0 ? <span className="font-semibold text-ok">Free</span> : money(delivery)}</dd></div>
            <div className="flex justify-between text-base font-bold"><dt>Total</dt><dd>{money(subtotal + delivery)}</dd></div>
          </dl>

          <fieldset className="space-y-2 border-t pt-3">
            <legend className="mb-2 flex w-full items-center justify-between text-sm font-semibold">
              Deliver to <Link href="/account/addresses?next=/shop" className="text-xs font-semibold text-indigo-700 hover:underline">{addresses.length ? "Manage" : "Add address"}</Link>
            </legend>
            {addresses.length === 0 ? (
              <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0" /> Add a delivery address before you check out.
              </p>
            ) : addresses.map((a) => (
              <label key={a.address_id} className={`flex cursor-pointer gap-3 rounded-xl border p-3 text-sm ${addressId === a.address_id ? "border-indigo-400 bg-indigo-50/60 ring-2 ring-indigo-100" : "border-slate-200"}`}>
                <input type="radio" name="address_id" value={a.address_id} checked={addressId === a.address_id} onChange={() => setAddressId(a.address_id)} className="mt-0.5 accent-indigo-600" />
                <span>
                  <span className="font-semibold">{a.label}</span> · {a.recipient}
                  <span className="block text-xs text-muted">{a.line1}, {a.suburb} {a.state} {a.postcode}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <label className="block text-sm font-semibold">Delivery notes <span className="font-normal text-muted">(optional)</span>
            <textarea name="notes" maxLength={300} rows={2} placeholder="e.g. Leave at the front door"
              className="mt-1 w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" />
          </label>

          <input type="hidden" name="cart" value={JSON.stringify(lines.map((l) => ({ product_id: l.p.product_id, quantity: l.qty })))} />
          {state.error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-bad">{state.error}</p>}
          <button className={`${btnPrimary} w-full py-3`} disabled={pending || lines.length === 0 || !addressId}>
            {pending ? "Placing order…" : `Place order · ${money(subtotal + delivery)}`}
          </button>
          <p className="text-center text-xs text-muted">Demo store: no payment is taken.</p>
        </form>
      </aside>
    </div>
  );
}
