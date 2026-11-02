import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "./errors";

// Knowledge Base: the articles the AI answers from.
// Reads go through v_knowledge_usage (RLS: everyone sees approved, knowledge managers see all).
// Writes go through save_knowledge_doc / set_knowledge_status, which check permission,
// enforce the draft -> review -> approved flow and write the audit log.

export type KnowledgeRow = {
  document_id: string; title: string; category: string; status: string; version: string; keywords: string;
  updated_at: string; approved_at: string | null; created_by_name: string | null; updated_by_name: string | null;
  approved_by_name: string | null; uses_30d: number;
};
export type KnowledgeDoc = KnowledgeRow & { content: string };


export async function listKnowledge(): Promise<{ data: KnowledgeRow[]; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("v_knowledge_usage").select("*").order("updated_at", { ascending: false });
  if (error) return { data: [], error: friendlyError(error, "loading the knowledge base") };
  return { data: (data ?? []) as KnowledgeRow[] };
}

export async function getKnowledgeDoc(id: string): Promise<KnowledgeDoc | null> {
  const supabase = await createClient();
  const [row, doc] = await Promise.all([
    supabase.from("v_knowledge_usage").select("*").eq("document_id", id).maybeSingle(),
    supabase.from("knowledge_documents").select("content").eq("document_id", id).maybeSingle(),
  ]);
  if (!row.data || !doc.data) return null;
  return { ...(row.data as KnowledgeRow), content: (doc.data as { content: string }).content };
}

async function rpc(fn: string, args: Record<string, unknown>, context: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { error: error.code === "22023" ? error.message : friendlyError(error, context) };
  return { data };
}

export const saveKnowledgeDoc = (d: { id: string | null; title: string; category: string; content: string; keywords: string }) =>
  rpc("save_knowledge_doc", { p_id: d.id, p_title: d.title, p_category: d.category, p_content: d.content, p_keywords: d.keywords }, "saving the article");

export const setKnowledgeStatus = (id: string, status: string) =>
  rpc("set_knowledge_status", { p_id: id, p_status: status }, "changing the article status");
