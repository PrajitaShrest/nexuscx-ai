"use server";

import { revalidatePath } from "next/cache";
import { markNoticeRead, markNotificationsRead } from "@/lib/data/workspace";

export async function markAllRead() {
  await markNotificationsRead();
  revalidatePath("/", "layout");
}

export async function readOne(id: string) {
  await markNoticeRead(id);
  revalidatePath("/", "layout");
}
