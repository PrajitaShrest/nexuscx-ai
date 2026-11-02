"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { CHOICE_COOKIE, isIndustry } from "@/lib/packs";

// "E-commerce demo / University demo": remembers the visitor's choice in
// their own browser for 30 days. It only changes what THIS visitor sees;
// the default for everyone else stays in Settings > Industry pack.
export async function choosePack(industry: string): Promise<{ error?: string }> {
  if (!isIndustry(industry)) return { error: "Choose E-commerce or University." };
  const store = await cookies();
  store.set(CHOICE_COOKIE, industry, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 30, secure: process.env.NODE_ENV === "production" });
  revalidatePath("/", "layout");
  return {};
}
