import Link from "next/link";
import { LogoMark } from "@/components/Logo";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm">
        <LogoMark size={44} className="mx-auto" />
        <p className="mt-4 text-sm font-semibold text-indigo-600">404</p>
        <h1 className="mt-1 text-lg font-semibold">We could not find that page</h1>
        <p className="mt-2 text-sm text-gray-600">The link may be old, or the item may belong to another account.</p>
        <Link href="/" className="mt-6 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Go home</Link>
      </div>
    </main>
  );
}
