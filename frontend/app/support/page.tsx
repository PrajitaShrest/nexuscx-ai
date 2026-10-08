import Link from "next/link";
import { redirect } from "next/navigation";
import { logout } from "@/app/auth/actions";
import Logo from "@/components/Logo";
import { STATUS, Pill } from "@/components/Badges";
import { getMe, isStaff } from "@/lib/data/me";
import { listCaseQueue } from "@/lib/data/cases";
import EnquiryForm from "./EnquiryForm";

// Customer portal: Contact Support + My Requests.
export default async function SupportPage() {
  const me = await getMe();
  if (isStaff(me)) redirect("/conversations");
  const { data: myCases } = await listCaseQueue(); // RLS returns only this customer's cases

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="flex items-center justify-between border-b bg-white px-6 py-4">
        <Logo size={34} />
        <div className="flex items-center gap-4 text-sm">
          <Link href="/profile" className="text-gray-600">{me.name}</Link>
          <form action={logout}><button className="text-gray-500 hover:text-gray-900">Log out</button></form>
        </div>
      </header>
      <main className="mx-auto grid max-w-5xl gap-6 p-6 md:grid-cols-3">
        <section className="md:col-span-2">
          <h1 className="text-xl font-semibold">Hi {me.name.split(" ")[0]}! How can we help today?</h1>
          <p className="mb-4 text-sm text-gray-500">AI-powered support, with a human team always available.</p>
          <EnquiryForm />
        </section>
        <aside>
          <h2 className="mb-2 font-semibold">My Requests</h2>
          {myCases.length === 0 && <p className="text-sm text-gray-500">No requests yet.</p>}
          <ul className="space-y-2">
            {myCases.map((c) => (
              <li key={c.case_id} className="rounded-lg border bg-white p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">{c.case_number}</span>
                  <Pill map={STATUS} value={c.status} />
                </div>
                <p className="mt-1 truncate text-sm">{c.subject}</p>
              </li>
            ))}
          </ul>
        </aside>
      </main>
    </div>
  );
}
