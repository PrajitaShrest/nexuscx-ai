import Link from "next/link";
import { getMe, isStaff, ROLE_LABEL } from "@/lib/data/me";
import ProfileForm from "./ProfileForm";

export default async function ProfilePage() {
  const me = await getMe();
  return (
    <div className="min-h-screen bg-gray-50 p-6 text-gray-900">
      <div className="mx-auto max-w-md space-y-4 rounded-lg border bg-white p-6">
        <Link href={isStaff(me) ? "/conversations" : "/support"} className="text-sm text-indigo-600">← Back</Link>
        <h1 className="text-xl font-semibold">My profile</h1>
        <dl className="grid grid-cols-3 gap-2 text-sm">
          <dt className="text-gray-500">Username</dt><dd className="col-span-2">{me.username}</dd>
          <dt className="text-gray-500">Email</dt><dd className="col-span-2">{me.email}</dd>
          <dt className="text-gray-500">Role</dt><dd className="col-span-2">{ROLE_LABEL[me.role]} <span className="text-xs text-gray-400">(only an administrator can change this)</span></dd>
          <dt className="text-gray-500">Team</dt><dd className="col-span-2">{me.team ?? "—"}</dd>
        </dl>
        <ProfileForm name={me.name} />
      </div>
    </div>
  );
}
