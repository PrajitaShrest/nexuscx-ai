"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requestReturn } from "@/lib/data/workspace";
import { check, formObject, returnSchema } from "@/lib/validation";

export type ReturnState = { error?: string };

export async function submitReturn(_p: ReturnState, f: FormData): Promise<ReturnState> {
  const v = check(returnSchema, formObject(f));
  if ("error" in v) return { error: v.error };
  const { order_id, kind, reason, details, items } = v.data;
  const r = await requestReturn(order_id, kind, reason, details, items);
  if (r.error) return { error: r.error };
  revalidatePath("/account", "layout");
  redirect("/account/returns?saved=return");
}
