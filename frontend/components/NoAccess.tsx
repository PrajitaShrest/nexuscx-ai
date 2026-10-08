import Link from "next/link";
import Sidebar from "./Sidebar";
import { ROLE_LABEL, type Me } from "@/lib/data/me";

// Shown when a signed-in staff member opens a page their roles do not allow.
export default function NoAccess({ me, page, needs }: { me: Me; page: string; needs: string }) {
  const roles = [me.role, ...me.extraRoles].map((r) => ROLE_LABEL[r] ?? r).join(" + ");
  return (
    <div className="flex min-h-screen bg-gray-50 text-ink">
      <Sidebar me={me} active="" />
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="max-w-md text-center">
          <p className="text-sm font-semibold text-bad">403 · No access</p>
          <h1 className="mt-2 text-2xl font-bold">You don&apos;t have access to {page}</h1>
          <p className="mt-3 text-muted">
            Your role ({roles}) doesn&apos;t include the &ldquo;{needs.replace(/_/g, " ")}&rdquo; permission.
            If you need it, ask an administrator.
          </p>
          <Link href="/" className="mt-6 inline-block rounded-lg bg-indigo-600 px-5 py-2.5 font-semibold text-white hover:bg-indigo-700">
            Go to my start page
          </Link>
        </div>
      </main>
    </div>
  );
}
