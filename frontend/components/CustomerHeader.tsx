import Link from "next/link";
import Logo from "./Logo";
import UserMenu from "./UserMenu";
import { menuUser, type Me } from "@/lib/data/me";

// Top bar for customer pages: logo, Help Centre link and the account menu.
export default function CustomerHeader({ me }: { me: Me }) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <Link href="/support" className="flex items-center gap-3">
          <Logo size={32} />
          <span className="hidden rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 sm:inline">Help Centre</span>
        </Link>
        <div className="w-auto sm:w-60"><UserMenu user={menuUser(me)} /></div>
      </div>
    </header>
  );
}
