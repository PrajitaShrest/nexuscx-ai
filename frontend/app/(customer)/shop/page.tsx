import { getMe } from "@/lib/data/me";
import { getOrder, listAddresses, listProducts } from "@/lib/data/shop";
import { PageHead } from "@/components/CustomerShell";
import ShopClient from "./ShopClient";

// Shop: browse products, build a cart, check out to a saved address.
// ?reorder=<order id> fills the cart with a past order ("Buy again").
export default async function ShopPage({ searchParams }: { searchParams: Promise<{ reorder?: string }> }) {
  await getMe();
  const { reorder } = await searchParams;
  const [products, addresses, past] = await Promise.all([listProducts(), listAddresses(), reorder ? getOrder(reorder) : null]);
  const initial: Record<string, number> = {};
  for (const i of past?.order_items ?? []) {
    const p = products.find((x) => x.product_id === i.product_id);
    if (p && p.stock > 0) initial[p.product_id] = Math.min(i.quantity, p.stock, 10);
  }
  return (
    <>
      <PageHead title="Shop" sub="Free delivery on orders over $100. Prices in AUD, including GST." />
      <ShopClient products={products} addresses={addresses} initial={initial} reordered={past?.order_number ?? null} />
    </>
  );
}
