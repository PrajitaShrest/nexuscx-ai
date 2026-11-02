import { listAddresses } from "@/lib/data/shop";
import { PageHead } from "@/components/CustomerShell";
import AddressBook from "./AddressBook";
import type { Metadata } from "next";
import { requireShop } from "@/lib/industry";

export const metadata: Metadata = { title: "Addresses" };

export default async function AddressesPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  await requireShop("/support");
  const { next } = await searchParams;
  const addresses = await listAddresses();
  return (
    <>
      <PageHead title="Delivery addresses" sub="Save up to 10 addresses. Your default is chosen first at checkout." />
      <AddressBook addresses={addresses} next={next === "/shop" ? "/shop" : ""} />
    </>
  );
}
