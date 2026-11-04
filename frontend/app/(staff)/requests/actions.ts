"use server";

import { revalidatePath } from "next/cache";
import { staffUpdateRequest } from "@/lib/data/requests";

const ACTIONS = ["start", "need_info", "ready", "collected", "reject"];

// Start, ask for changes, mark ready, mark collected or reject a request.
// The database checks the staff member's permission and the request's status.
export async function actOnRequest(id: string, action: string, note: string): Promise<{ error?: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(id) || !ACTIONS.includes(action)) return { error: "That action is not available." };
  const text = note.trim();
  if (text.length > 500) return { error: "Please keep the note under 500 characters." };
  if ((action === "need_info" || action === "reject") && text.length < 10) {
    return { error: action === "reject" ? "Please give the reason (at least 10 characters)." : "Please say what needs changing (at least 10 characters)." };
  }
  const { error } = await staffUpdateRequest(id, action, text || null);
  if (error) return { error };
  revalidatePath(`/requests/${id}`);
  revalidatePath("/requests");
  return {};
}
