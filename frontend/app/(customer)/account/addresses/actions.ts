"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { deleteAddress, saveAddress, setDefaultAddress } from "@/lib/data/shop";
import { normaliseMobile } from "@/lib/auth/phone";

export type AddressState = { error?: string; field?: string };

const SAFE_NEXT = ["/shop", "/account"];

export async function save(_p: AddressState, f: FormData): Promise<AddressState> {
  const v = (k: string) => String(f.get(k) ?? "").trim();
  const phoneRaw = v("phone");
  let phone = "";
  if (phoneRaw) {
    const p = normaliseMobile(phoneRaw);
    if (!p) return { error: "Enter an Australian mobile, like 0412 345 678.", field: "phone" };
    phone = p;
  }
  if (v("recipient").length < 2) return { error: "Please enter who will receive the delivery.", field: "recipient" };
  if (v("line1").length < 3) return { error: "Please enter the street address.", field: "line1" };
  if (v("suburb").length < 2) return { error: "Please enter the suburb.", field: "suburb" };
  if (!/^\d{4}$/.test(v("postcode"))) return { error: "Postcode must be 4 digits.", field: "postcode" };

  const r = await saveAddress({
    id: v("address_id") || null, label: v("label"), recipient: v("recipient"), line1: v("line1"), line2: v("line2"),
    suburb: v("suburb"), state: v("state"), postcode: v("postcode"), phone, isDefault: f.get("is_default") === "on",
  });
  if (r.error) return { error: r.error };
  revalidatePath("/account", "layout");
  const next = v("next");
  redirect(`${SAFE_NEXT.includes(next) ? next : "/account/addresses"}?saved=address`);
}

export async function remove(id: string): Promise<{ error?: string }> {
  const r = await deleteAddress(id);
  revalidatePath("/account", "layout");
  return r.error ? { error: r.error } : {};
}

export async function makeDefault(id: string): Promise<{ error?: string }> {
  const r = await setDefaultAddress(id);
  revalidatePath("/account", "layout");
  return r.error ? { error: r.error } : {};
}
