import Link from "next/link";
import { redirect } from "next/navigation";
import { getRequestForms } from "@/lib/data/requests";
import RequestForm from "@/components/requests/RequestForm";
import FormIcon from "@/components/requests/FormIcon";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "New request" };

export default async function NewRequestPage({ searchParams }: { searchParams: Promise<{ type?: string; order?: string }> }) {
  const { type: key, order } = await searchParams;
  const { types, prefill } = await getRequestForms();
  const type = types.find((t) => t.type_key === key);
  if (!type) redirect("/account/requests");

  return (
    <>
      <div>
        <Link href="/account/requests" className="text-sm font-medium text-indigo-700 hover:underline">← Requests &amp; forms</Link>
        <div className="mt-2 flex items-center gap-3">
          <FormIcon icon={type.icon} />
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{type.title}</h1>
            <p className="text-muted">{type.summary}</p>
          </div>
        </div>
      </div>
      <RequestForm type={type} prefill={prefill} saved={order && /^NX-\d{3,8}$/.test(order) ? { order } : undefined} />
    </>
  );
}
