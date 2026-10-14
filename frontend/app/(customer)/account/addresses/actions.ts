"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { deleteAddress, saveAddress, setDefaultAddress } from "@/lib/data/shop";
import { addressSchema, check, formObject } from "@/lib/validation";

export type AddressState = { error?: string; field?: string };

const SAFE_NEXT = ["/shop", "/account"];

export async function save(_p: AddressState, f: FormData): Promise<AddressState> {
  // Shared rules in lib/validation (the database checks again)
  const v = check(addressSchema, formObject(f));
  if ("error" in v) return v;
  const a = v.data;
  const r = await saveAddress({
    id: a.address_id, label: a.label, recipient: a.recipient, line1: a.line1, line2: a.line2,
    suburb: a.suburb, state: a.state, postcode: a.postcode, phone: a.phone, isDefault: a.is_default,
  });
  if (r.error) return { error: r.error };
  revalidatePath("/account", "layout");
  const next = a.next;
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
