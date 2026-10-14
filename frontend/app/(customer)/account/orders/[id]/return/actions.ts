"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requestReturn } from "@/lib/data/workspace";

export type ReturnState = { error?: string };

export async function submitReturn(_p: ReturnState, f: FormData): Promise<ReturnState> {
  const orderId = String(f.get("order_id") ?? "");
  const kind = String(f.get("kind") ?? "");
  const reason = String(f.get("reason") ?? "");
  const details = String(f.get("details") ?? "").trim();
  let items: { order_item_id: string; quantity: number; exchange_for?: string }[] = [];
  try { items = JSON.parse(String(f.get("items") ?? "[]")); } catch { return { error: "Please choose the items again." }; }
  if (!["return", "exchange"].includes(kind)) return { error: "Please choose return or exchange." };
  if (!reason) return { error: "Please choose a reason." };
  if (items.length === 0) return { error: "Please choose at least one item." };
  if (kind === "exchange" && items.some((i) => !i.exchange_for?.trim())) return { error: "Tell us what you'd like instead for each item (for example, size or colour)." };
  const r = await requestReturn(orderId, kind, reason, details, items);
  if (r.error) return { error: r.error };
  revalidatePath("/account", "layout");
  redirect("/account/returns?saved=return");
}
