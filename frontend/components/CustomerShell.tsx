import Link from "next/link";
import Logo from "./Logo";
import UserMenu from "./UserMenu";
import { SideLinks, TopTabs } from "./CustomerNav";
import { menuUser, type Me } from "@/lib/data/me";
import { unreadCount } from "@/lib/data/workspace";
import { getPack } from "@/lib/industry";
import PackSwitch from "./PackSwitch";

// Frame for every customer page: the same dark sidebar as the staff workspace
// on desktop, and a top bar with tabs on smaller screens.
export default async function CustomerShell({ me, children }: { me: Me; children: React.ReactNode }) {
  const [unread, pack] = await Promise.all([unreadCount(), getPack()]);
  return (
    <div className="flex min-h-screen bg-slate-50 text-ink">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-navy text-slate-300 lg:flex">
        <div className="px-5 py-5">
          <Link href={pack.shop ? "/account" : "/support"}><Logo tone="light" size={34} /></Link>
          <span className="mt-2 inline-block rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-200">{pack.account}</span>
          <div className="mt-3"><PackSwitch current={pack.id} tone="dark" /></div>
        </div>
        <SideLinks unread={unread} shop={pack.shop} />
        <div className="border-t border-white/10 p-3">
          <UserMenu user={menuUser(me)} dark up />
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/90 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-2.5">
            <Link href={pack.shop ? "/account" : "/support"}><Logo size={30} /></Link>
            <div className="flex items-center gap-2">
              <PackSwitch current={pack.id} short />
              <div className="w-auto sm:w-56"><UserMenu user={menuUser(me)} /></div>
            </div>
          </div>
          <TopTabs unread={unread} shop={pack.shop} />
        </header>
        <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}

// Page title row used on every customer page
export function PageHead({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h1>
        {sub && <p className="mt-1 text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}
