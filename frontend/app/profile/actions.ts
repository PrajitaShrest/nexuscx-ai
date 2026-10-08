"use server";

import { revalidatePath } from "next/cache";
import { getMe } from "@/lib/data/me";
import { updateMyName } from "@/lib/data/users";

export type ProfileState = { error?: string; ok?: string };

export async function saveName(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const me = await getMe(); // the user id comes from the session, never from the form
  const { error } = await updateMyName(me.user_id, String(formData.get("name") ?? ""));
  if (error) return { error };
  revalidatePath("/", "layout");
  return { ok: "Saved." };
}
