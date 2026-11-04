"use server";

import { revalidatePath } from "next/cache";
import { applyForCredit, checkCredit, type CreditResult, type PriorUnit } from "@/lib/data/requests";

export type CreditInput = { course: string; intake: string; load: string; institution: string; qualification: string; units: PriorUnit[]; document: string | null };

const clean = (units: PriorUnit[]) => units.slice(0, 40).map((u) => ({
  name: String(u.name ?? "").trim().slice(0, 120), code: String(u.code ?? "").trim().slice(0, 12),
  grade: String(u.grade ?? "").trim().slice(0, 20), year: String(u.year ?? "").trim().slice(0, 4),
})).filter((u) => u.name.length >= 3);

// The AI Credit Assessor's decision, without saving anything
export async function previewCredit(i: CreditInput): Promise<{ result?: CreditResult; error?: string }> {
  const units = clean(i.units);
  if (units.length === 0) return { error: "Please add at least one unit you passed." };
  const { data, error } = await checkCredit(i.course, i.institution, units);
  return error || !data ? { error: error ?? "Something went wrong. Please try again." } : { result: data };
}

// Apply: the same check runs again in the database, and the decision is saved
export async function submitCredit(i: CreditInput): Promise<{ request_id?: string; error?: string }> {
  const units = clean(i.units);
  if (i.document && !/^[0-9a-f-]{36}\/[A-Za-z0-9-]+\.(pdf|jpg|jpeg|png|webp)$/.test(i.document)) return { error: "Your transcript file did not upload correctly." };
  const { data, error } = await applyForCredit({ ...i, institution: i.institution.trim(), qualification: i.qualification.trim(), units });
  if (error || !data) return { error: error ?? "Something went wrong. Please try again." };
  revalidatePath("/account/requests");
  return { request_id: data.request_id };
}
