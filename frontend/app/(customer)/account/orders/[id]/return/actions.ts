"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { attachReturnPhotos, requestReturn } from "@/lib/data/workspace";
import { check, formObject, returnSchema } from "@/lib/validation";

export type ReturnState = { error?: string };

export async function submitReturn(_p: ReturnState, f: FormData): Promise<ReturnState> {
  const v = check(returnSchema, formObject(f));
  if ("error" in v) return { error: v.error };
  const { order_id, kind, reason, details, items } = v.data;
  const photos = v.data.photos;
  const r = await requestReturn(order_id, kind, reason, details, items);
  if (r.error) return { error: r.error };
  if (photos.length) {
    const p = await attachReturnPhotos((r.data as { return_id: string }).return_id, photos);
    if (p.error) console.error("[attachReturnPhotos]", p.error); // the request itself is saved; staff can ask for photos in the chat
  }
  revalidatePath("/account", "layout");
  redirect("/account/returns?saved=return");
}
