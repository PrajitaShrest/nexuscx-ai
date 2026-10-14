import Sidebar from "@/components/Sidebar";
import NoAccess from "@/components/NoAccess";
import NoticeList from "@/components/NoticeList";
import { can, getMe } from "@/lib/data/me";
import { listNotifications } from "@/lib/data/workspace";

// Staff inbox: new escalations, customer replies, return requests.
export default async function InboxPage() {
  const me = await getMe();
  if (!can(me, "view_cases")) return <NoAccess me={me} page="Inbox" needs="view_cases" />;
  const notices = await listNotifications(100);
  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900">
      <Sidebar me={me} active="/inbox" />
      <main className="min-w-0 flex-1 p-6">
        <h1 className="text-xl font-semibold">Inbox</h1>
        <p className="mb-4 text-sm text-gray-500">Cases sent to people, customer replies and return requests. Click one to open the case.</p>
        <div className="max-w-3xl"><NoticeList notices={notices} /></div>
      </main>
    </div>
  );
}
