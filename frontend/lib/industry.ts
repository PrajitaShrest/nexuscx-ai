import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { CHOICE_COOKIE, PACKS, isIndustry, type Industry, type Pack } from "./packs";

export { PACKS, type Industry, type Pack } from "./packs";

// The active industry pack (setting "industry", migration 017).
// One lookup per request. Works signed in or signed out.
// The database decides (migration 021): the signed-in account's own organisation
// first, then the visitor's chosen demo (sent as the x-nexus-industry header),
// then the default from Settings.
export const getIndustry = cache(async function getIndustry(): Promise<Industry> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("current_industry");
  if (!error && isIndustry(data)) return data;
  if (error) console.error("[getIndustry]", error.message);
  const choice = (await cookies()).get(CHOICE_COOKIE)?.value;
  return isIndustry(choice) ? choice : "ecommerce";
});

export async function getPack(): Promise<Pack> {
  return PACKS[await getIndustry()];
}

// Shop screens (orders, returns, addresses) only exist in the e-commerce pack.
// Call at the top of those pages; other packs are sent to their home page.
export async function requireShop(home: "/support" | "/dashboard") {
  if (!(await getPack()).shop) redirect(home);
}
