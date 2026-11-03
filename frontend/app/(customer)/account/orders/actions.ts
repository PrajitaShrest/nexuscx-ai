"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { aiChangeOrderOption, askAboutOrder, cancelOrder, getOrder, type ChangeResult } from "@/lib/data/shop";

export type OrderActionState = { error?: string };

export async function cancel(_p: OrderActionState, f: FormData): Promise<OrderActionState> {
  const id = String(f.get("order_id") ?? "");
  const r = await cancelOrder(id);
  if (r.error) return { error: r.error };
  revalidatePath("/account", "layout");
  redirect(`/account/orders/${id}?saved=cancelled`);
}

// Starts a support chat linked to this order, then opens it
export async function ask(_p: OrderActionState, f: FormData): Promise<OrderActionState> {
  const id = String(f.get("order_id") ?? "");
  const message = String(f.get("message") ?? "").trim();
  if (message.length < 5) return { error: "Please tell us a little more (at least 5 characters)." };
  if (message.length > 1500) return { error: "Please keep it under 1500 characters." };
  const r = await askAboutOrder(id, message);
  if (r.error) return { error: r.error };
  const res = r.data as { case_id: string };
  revalidatePath("/account", "layout");
  redirect(`/account/chats/${res.case_id}`);
}

// Change a size or colour on this order (the Orders Agent, migration 025).
// The customer is signed in and on their own order, so the order's own number and
// delivery postcode are used for the check. Without an item it lists the options.
export async function sizeOptions(orderId: string, item: string | null = null, value: string | null = null): Promise<ChangeResult> {
  const o = await getOrder(orderId);
  if (!o) return { status: "error", message: "This order could not be found." };
  const postcode = o.ship_address.match(/.*(\d{4})/)?.[1] ?? "";
  if (item && !/^[0-9a-f-]{36}$/i.test(item)) return { status: "error", message: "That item could not be found." };
  const { data, error } = await aiChangeOrderOption(o.order_number, postcode, item, value ? value.slice(0, 30) : null);
  if (error || !data) return { status: "error", message: error ?? "Something went wrong. Please try again." };
  if (data.status === "changed") revalidatePath(`/account/orders/${orderId}`);
  return data;
}
