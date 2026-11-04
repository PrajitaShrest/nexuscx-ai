import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/data/me";
import { getPack } from "@/lib/industry";
import CreditChecker from "./CreditChecker";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Credit for previous study" };

// The AI Credit Assessor: students add the units they passed before and get a decision straight away.
export default async function CreditPage() {
  const [me, pack] = await Promise.all([getMe(), getPack()]);
  if (pack.shop) redirect("/account/requests");
  return (
    <>
      <div>
        <Link href="/account/requests" className="text-sm font-medium text-indigo-700 hover:underline">← Requests &amp; forms</Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Credit for previous study</h1>
        <p className="mt-1 max-w-2xl text-muted">Already passed units at another university or TAFE? Add them below and the AI shows straight away which Northbridge units you can skip, and when you could finish.</p>
      </div>
      <CreditChecker name={me.name} />
    </>
  );
}
