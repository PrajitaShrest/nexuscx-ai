"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { placeOrder } from "@/lib/data/shop";
import { check, checkoutSchema, formObject } from "@/lib/validation";

export type CheckoutState = { error?: string };

// Prices, stock and totals are worked out again in the database (place_order).
export async function checkout(_p: CheckoutState, f: FormData): Promise<CheckoutState> {
  const v = check(checkoutSchema, formObject(f));
  if ("error" in v) return { error: v.error };
  const { address_id, cart, notes } = v.data;
  const r = await placeOrder(address_id, cart, notes);
  if (r.error) return { error: r.error };
  const order = r.data as { order_id: string };
  revalidatePath("/account", "layout");
  redirect(`/account/orders/${order.order_id}?saved=order`);
}
