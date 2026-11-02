import Link from "next/link";
import Logo from "./Logo";

export default function LegalPage({ title, updated, industry = "ecommerce", children }: {
  title: string; updated: string; industry?: "ecommerce" | "university"; children: React.ReactNode;
}) {
  const org = industry === "university" ? "Northbridge University and NexusCX AI are" : "NexusCX Store and NexusCX AI are";
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b px-6 py-4"><Link href="/login"><Logo size={32} /></Link></header>
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-3xl font-bold text-ink">{title}</h1>
        <p className="mt-1 text-sm text-muted">Last updated {updated}. Student project: {org} not real organisations.</p>
        <div className="mt-8 space-y-6 leading-relaxed text-ink [&_h2]:text-lg [&_h2]:font-bold [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6">
          {children}
        </div>
      </main>
    </div>
  );
}
