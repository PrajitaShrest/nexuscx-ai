"use server";

import { revalidatePath } from "next/cache";
import { markNotificationsRead } from "@/lib/data/workspace";

export async function markAllRead() {
  await markNotificationsRead();
  revalidatePath("/", "layout");
}
