import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PACKS, isIndustry, type Industry, type Pack } from "./packs";

export { PACKS, type Industry, type Pack } from "./packs";

// The active industry pack (setting "industry", migration 017).
// One lookup per request. Works signed in or signed out.
export const getIndustry = cache(async function getIndustry(): Promise<Industry> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("current_industry");
  if (error) console.error("[getIndustry]", error.message);
  return isIndustry(data) ? data : "ecommerce";
});

export async function getPack(): Promise<Pack> {
  return PACKS[await getIndustry()];
}

// Shop screens (orders, returns, addresses) only exist in the e-commerce pack.
// Call at the top of those pages; other packs are sent to their home page.
export async function requireShop(home: "/support" | "/dashboard") {
  if (!(await getPack()).shop) redirect(home);
}
