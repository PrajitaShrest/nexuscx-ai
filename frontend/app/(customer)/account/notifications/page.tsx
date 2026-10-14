import { listNotifications } from "@/lib/data/workspace";
import { PageHead } from "@/components/CustomerShell";
import NoticeList from "@/components/NoticeList";

export default async function CustomerNotificationsPage() {
  const notices = await listNotifications();
  return (
    <>
      <PageHead title="Notifications" sub="Replies from our team, order updates and return progress." />
      <NoticeList notices={notices} />
    </>
  );
}
