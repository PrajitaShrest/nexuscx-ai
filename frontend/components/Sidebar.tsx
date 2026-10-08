import Link from "next/link";
import Logo from "./Logo";
import { menuUser, type Me } from "@/lib/data/me";
import UserMenu from "./UserMenu";

// Menu from the Figma prototype. Each item needs one permission; a role
// without it never sees the item. The same permission is checked on the
// page itself and in the database, so hiding is never the only protection.
// "week" marks screens planned for later sprints.
export const NAV: { section: string; items: { label: string; href?: string; week?: number; needs: string }[] }[] = [
  { section: "", items: [
    { label: "Dashboard", week: 8, needs: "view_cases" },
    { label: "Conversations", href: "/conversations", needs: "view_cases" },
    { label: "Cases", href: "/cases", needs: "view_cases" },
    { label: "Customers", week: 7, needs: "view_cases" },
  ]},
  { section: "AI operations", items: [
    { label: "AI Agents", week: 8, needs: "configure_ai" },
    { label: "Routing & Escalation", week: 8, needs: "configure_ai" },
    { label: "Knowledge Base", week: 7, needs: "manage_knowledge" },
  ]},
  { section: "Insights", items: [
    { label: "Analytics", week: 9, needs: "view_analytics" },
    { label: "Team Operations", week: 9, needs: "view_analytics" },
  ]},
  { section: "Administration", items: [
    { label: "Users & Roles", href: "/users", needs: "manage_users" },
    { label: "Audit Logs", week: 8, needs: "view_audit_logs" },
    { label: "Settings", week: 9, needs: "configure_ai" },
  ]},
];

export default function Sidebar({ me, active }: { me: Me; active: string }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-navy text-slate-300 md:flex">
      <div className="px-5 py-5"><Logo tone="light" size={34} /></div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {NAV.map((group) => {
          const items = group.items.filter((i) => me.permissions.includes(i.needs));
          if (items.length === 0) return null;
          return (
            <div key={group.section || "main"}>
              {group.section && <p className="px-2 pb-1 text-xs font-semibold text-slate-500">{group.section}</p>}
              {items.map((item) =>
                item.href ? (
                  <Link key={item.label} href={item.href}
                    className={`block rounded-md px-2 py-2 text-sm ${active.startsWith(item.href) ? "bg-indigo-600 text-white" : "hover:bg-white/5"}`}>
                    {item.label}
                  </Link>
                ) : (
                  <p key={item.label} className="flex items-center justify-between rounded-md px-2 py-2 text-sm text-slate-500" title="Planned for a later sprint">
                    {item.label}
                    <span className="rounded bg-white/5 px-1.5 text-[11px]">Wk {item.week}</span>
                  </p>
                ),
              )}
            </div>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-3">
        <UserMenu user={menuUser(me)} dark up />
      </div>
    </aside>
  );
}
