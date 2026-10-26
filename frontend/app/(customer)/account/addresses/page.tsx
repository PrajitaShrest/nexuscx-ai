import { listAddresses } from "@/lib/data/shop";
import { PageHead } from "@/components/CustomerShell";
import AddressBook from "./AddressBook";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Addresses" };

export default async function AddressesPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const addresses = await listAddresses();
  return (
    <>
      <PageHead title="Delivery addresses" sub="Save up to 10 addresses. Your default is chosen first at checkout." />
      <AddressBook addresses={addresses} next={next === "/shop" ? "/shop" : ""} />
    </>
  );
}
