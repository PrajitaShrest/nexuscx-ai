"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { askAboutOrder, cancelOrder } from "@/lib/data/shop";

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
