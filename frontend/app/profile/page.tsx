import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import CustomerHeader from "@/components/CustomerHeader";
import Avatar, { PRESENCE } from "@/components/Avatar";
import { CalendarIcon, CheckIcon, ClockIcon, KeyIcon, ShieldIcon, UserIcon, XIcon } from "@/components/Icons";
import { getMe, isStaff, ROLE_LABEL } from "@/lib/data/me";
import { getProfile } from "@/lib/data/profile";
import { listCaseQueue } from "@/lib/data/cases";
import { displayMobile } from "@/lib/auth/phone";
import { DetailsForm, PasswordForm } from "./ProfileForms";

const PERMISSION_TEXT: Record<string, string> = {
  view_cases: "See conversations and cases",
  resolve_cases: "Reply to and resolve cases",
  manage_knowledge: "Edit the knowledge base",
  configure_ai: "Configure AI agents and routing",
  view_analytics: "View analytics and team reports",
  view_audit_logs: "View audit logs",
  manage_users: "Manage users and roles",
};

const date = (iso: string | null, time = false) => iso
  ? new Date(iso).toLocaleString("en-AU", time ? { dateStyle: "medium", timeStyle: "short", timeZone: "Australia/Sydney" } : { dateStyle: "long", timeZone: "Australia/Sydney" })
  : "—";

function Card({ title, icon, children, id }: { title: string; icon: React.ReactNode; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-5 flex items-center gap-2.5 text-lg font-bold text-ink">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">{icon}</span>{title}
      </h2>
      {children}
    </section>
  );
}

export default async function ProfilePage() {
  const me = await getMe();
  const staff = isStaff(me);
  const p = await getProfile(me);
  const roles = [me.role, ...me.extraRoles].map((r) => ROLE_LABEL[r] ?? r);

  // Customers: how complete is the profile, and a summary of their requests
  const checks = [
    ["Full name", me.name.trim().length >= 2],
    ["Mobile number", !!p.phone],
    ["Date of birth", !!p.date_of_birth],
    ["Delivery address", !!p.address],
  ] as const;
  const percent = Math.round((checks.filter(([, ok]) => ok).length / checks.length) * 100);
  const cases = staff ? [] : (await listCaseQueue()).data;
  const openCount = cases.filter((c) => !["resolved", "closed"].includes(c.status)).length;

  const body = (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      {/* Cover */}
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="relative h-32 bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500 sm:h-40">
          <div className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10" />
          <div className="absolute bottom-0 right-40 h-28 w-28 translate-y-1/2 rounded-full bg-white/10" />
          <Link href="/" className="absolute left-4 top-4 rounded-full bg-white/15 px-3 py-1.5 text-sm font-medium text-white backdrop-blur hover:bg-white/25">
            ← {staff ? "Back to workspace" : "Back to Help Centre"}
          </Link>
        </div>
        <div className="flex flex-wrap items-end gap-5 px-6 pb-6">
          <div className="-mt-12 rounded-full bg-white p-1.5 shadow-lg">
            <Avatar name={me.name} size={96} presence={staff ? me.presence : undefined} />
          </div>
          <div className="min-w-0 flex-1 pt-3">
            <h1 className="truncate text-2xl font-bold text-ink sm:text-3xl">{me.name}</h1>
            <p className="text-muted">@{me.username} · {me.email}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {roles.map((r) => <span key={r} className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200">{r}</span>)}
              {me.team && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">Team: {me.team}</span>}
              {staff && <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                <span className={`h-2 w-2 rounded-full ${PRESENCE[me.presence]?.dot}`} />{PRESENCE[me.presence]?.label}</span>}
              {p.tier && <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold capitalize text-amber-800 ring-1 ring-amber-200">{p.tier} member</span>}
            </div>
          </div>
          <div className="flex gap-6 text-sm">
            <div><p className="text-muted">Member since</p><p className="font-semibold">{date(p.created_at)}</p></div>
            <div><p className="text-muted">Last sign-in</p><p className="font-semibold">{date(p.last_sign_in_at, true)}</p></div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Card title="Personal details" icon={<UserIcon className="h-5 w-5" />}>
            <DetailsForm init={{
              name: me.name, username: me.username, email: me.email, customer: !staff,
              phone: displayMobile(p.phone), address: p.address ?? "", dob: p.date_of_birth ?? "",
            }} />
          </Card>
          <Card id="security" title="Password & security" icon={<KeyIcon className="h-5 w-5" />}>
            <PasswordForm />
          </Card>
        </div>

        <aside className="min-w-0 space-y-6">
          {staff ? (
            <Card title="What you can do" icon={<ShieldIcon className="h-5 w-5" />}>
              <p className="-mt-2 mb-4 text-sm text-muted">From your role{roles.length > 1 ? "s" : ""}: {roles.join(" + ")}. Only an administrator can change this.</p>
              <ul className="space-y-2">
                {Object.entries(PERMISSION_TEXT).map(([perm, text]) => {
                  const ok = me.permissions.includes(perm);
                  return (
                    <li key={perm} className={`flex items-center gap-3 text-sm ${ok ? "text-ink" : "text-slate-400"}`}>
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full ${ok ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
                        {ok ? <CheckIcon className="h-3.5 w-3.5" /> : <XIcon className="h-3.5 w-3.5" />}
                      </span>{text}
                    </li>
                  );
                })}
              </ul>
            </Card>
          ) : (
            <>
              <Card title="Profile strength" icon={<UserIcon className="h-5 w-5" />}>
                <div className="flex items-center gap-4">
                  <div className="relative h-20 w-20 shrink-0 rounded-full" style={{ background: `conic-gradient(#6366f1 ${percent * 3.6}deg, #e2e8f0 0deg)` }}>
                    <div className="absolute inset-2 flex items-center justify-center rounded-full bg-white text-lg font-bold">{percent}%</div>
                  </div>
                  <p className="text-sm text-muted">{percent === 100 ? "All done! Your profile is complete." : "Complete your profile so our team can help you faster."}</p>
                </div>
                <ul className="mt-4 space-y-2 text-sm">
                  {checks.map(([label, ok]) => (
                    <li key={label} className={`flex items-center gap-2.5 ${ok ? "text-ink" : "text-muted"}`}>
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full ${ok ? "bg-emerald-500 text-white" : "border-2 border-slate-300"}`}>
                        {ok && <CheckIcon className="h-3 w-3" />}
                      </span>{label}
                    </li>
                  ))}
                </ul>
              </Card>
              <Card title="My support" icon={<ClockIcon className="h-5 w-5" />}>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-indigo-50 p-4"><p className="text-2xl font-bold text-indigo-700">{openCount}</p><p className="text-xs text-indigo-700">Open requests</p></div>
                  <div className="rounded-2xl bg-emerald-50 p-4"><p className="text-2xl font-bold text-emerald-700">{cases.length - openCount}</p><p className="text-xs text-emerald-700">Resolved</p></div>
                </div>
                <Link href="/support" className="mt-4 block rounded-xl border border-slate-200 py-2.5 text-center text-sm font-semibold text-indigo-700 hover:bg-indigo-50">Go to Help Centre →</Link>
              </Card>
            </>
          )}
          <Card title="Your privacy" icon={<CalendarIcon className="h-5 w-5" />}>
            <ul className="space-y-2 text-sm text-muted">
              <li>• Your password is stored only as a secure hash. Nobody, not even our staff, can see it.</li>
              <li>• After 5 wrong passwords, sign-in is paused for 15 minutes.</li>
              <li>• Read our <Link href="/privacy" className="font-medium text-indigo-700 hover:underline">Privacy Policy</Link> and <Link href="/terms" className="font-medium text-indigo-700 hover:underline">Terms</Link>.</li>
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );

  return staff ? (
    <div className="flex min-h-screen bg-slate-50 text-ink">
      <Sidebar me={me} active="/profile" />
      <main className="min-w-0 flex-1">{body}</main>
    </div>
  ) : (
    <div className="min-h-screen bg-slate-50 text-ink">
      <CustomerHeader me={me} />
      <main>{body}</main>
    </div>
  );
}
