"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { placeOrder } from "@/lib/data/shop";

export type CheckoutState = { error?: string };

// Prices, stock and totals are worked out again in the database (place_order).
export async function checkout(_p: CheckoutState, f: FormData): Promise<CheckoutState> {
  const addressId = String(f.get("address_id") ?? "");
  const notes = String(f.get("notes") ?? "").trim();
  let items: { product_id: string; quantity: number }[] = [];
  try {
    items = JSON.parse(String(f.get("cart") ?? "[]"));
  } catch {
    return { error: "Your cart could not be read. Please try again." };
  }
  if (!addressId) return { error: "Please choose a delivery address." };
  if (!Array.isArray(items) || items.length === 0) return { error: "Your cart is empty." };
  if (notes.length > 300) return { error: "Delivery notes can be up to 300 characters." };

  const r = await placeOrder(addressId, items.map((i) => ({ product_id: String(i.product_id), quantity: Number(i.quantity) })), notes);
  if (r.error) return { error: r.error };
  const order = r.data as { order_id: string };
  revalidatePath("/account", "layout");
  redirect(`/account/orders/${order.order_id}?saved=order`);
}
