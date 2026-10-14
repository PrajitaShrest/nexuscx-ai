"use server";

import { revalidatePath } from "next/cache";
import { staffUpdateOrder } from "@/lib/data/shop";

export type StaffOrderState = { error?: string; ok?: string };

// The database checks resolve_cases and that the status change is allowed.
export async function updateOrder(_p: StaffOrderState, f: FormData): Promise<StaffOrderState> {
  const id = String(f.get("order_id") ?? "");
  const status = String(f.get("status") ?? "");
  const tracking = String(f.get("tracking") ?? "").trim();
  const r = await staffUpdateOrder(id, status, tracking);
  if (r.error) return { error: r.error };
  revalidatePath("/orders");
  return { ok: "Updated" };
}
