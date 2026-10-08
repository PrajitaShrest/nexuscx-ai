import Sidebar from "@/components/Sidebar";
import NoAccess from "@/components/NoAccess";
import { getMe, can } from "@/lib/data/me";
import { listPeople } from "@/lib/data/admin";
import { listRolePermissions } from "@/lib/data/users";
import PeopleTable from "./PeopleTable";
import PermissionMatrix from "./PermissionMatrix";

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const me = await getMe();
  // Administrators only. Checked here on the server; every admin action is checked again in the database.
  if (!can(me, "manage_users")) return <NoAccess me={me} page="Users & Roles" needs="manage_users" />;
  const { deleted } = await searchParams;
  const { data: people, error } = await listPeople();
  const matrix = await listRolePermissions();
  const staff = people.filter((p) => p.role !== "customer");
  const stats = [
    ["Staff", staff.length],
    ["Customers", people.length - staff.length],
    ["Suspended", people.filter((p) => p.status === "suspended").length],
    ["No login yet", staff.filter((p) => !p.has_login).length],
  ] as const;

  return (
    <div className="flex min-h-screen bg-gray-50 text-ink">
      <Sidebar me={me} active="/users" />
      <main className="flex-1 space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold">Users &amp; Roles</h1>
          <p className="text-muted">Manage who can sign in and what they can do. Every change is recorded in the audit log.</p>
        </div>
        {deleted && (
          <p role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-ok">
            {deleted === "anonymised"
              ? "Account deleted. Their past cases are kept, with their personal details removed."
              : "Account deleted completely."}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          {stats.map(([k, v]) => (
            <div key={k} className="min-w-32 rounded-xl border bg-white px-5 py-3"><p className="text-sm text-muted">{k}</p><p className="text-2xl font-bold">{v}</p></div>
          ))}
        </div>
        {error && <p className="rounded-lg bg-red-50 p-3 text-bad">{error}</p>}
        <PeopleTable people={people} meId={me.user_id} />
        <PermissionMatrix granted={[...matrix]} />
      </main>
    </div>
  );
}
