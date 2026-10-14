"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { saveKnowledgeDoc, setKnowledgeStatus } from "@/lib/data/knowledge";
import { check, formObject, knowledgeSchema } from "@/lib/validation";

export type KbState = { error?: string; field?: string; ok?: string; at?: number };

export async function saveDoc(_p: KbState, f: FormData): Promise<KbState> {
  const v = check(knowledgeSchema, formObject(f));
  if ("error" in v) return v;
  const r = await saveKnowledgeDoc({ id: v.data.document_id, title: v.data.title, category: v.data.category, content: v.data.content, keywords: v.data.keywords });
  if (r.error) return { error: r.error };
  revalidatePath("/knowledge");
  redirect(`/knowledge/${r.data as string}?saved=article`);
}

const OK: Record<string, string> = {
  under_review: "Sent for review. Another knowledge manager must approve it.",
  approved: "Approved. The AI can now use this article.",
  draft: "Moved back to draft.",
  disabled: "Disabled. The AI will stop using it.",
  archived: "Archived.",
};

export async function changeStatus(_p: KbState, f: FormData): Promise<KbState> {
  const id = String(f.get("document_id") ?? "");
  const status = String(f.get("status") ?? "");
  if (!(status in OK)) return { error: "Unknown status." };
  const r = await setKnowledgeStatus(id, status);
  if (r.error) return { error: r.error };
  revalidatePath("/knowledge");
  revalidatePath(`/knowledge/${id}`);
  return { ok: OK[status], at: Date.now() };
}
