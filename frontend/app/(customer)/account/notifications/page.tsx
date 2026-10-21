import { listNotifications } from "@/lib/data/workspace";
import { PageHead } from "@/components/CustomerShell";
import NoticeList from "@/components/NoticeList";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Notifications" };

export default async function CustomerNotificationsPage() {
  const notices = await listNotifications();
  return (
    <>
      <PageHead title="Notifications" sub="Replies from our team, order updates and return progress." />
      <NoticeList notices={notices} />
    </>
  );
}
