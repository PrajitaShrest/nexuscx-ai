import { listNotifications } from "@/lib/data/workspace";
import { PageHead } from "@/components/CustomerShell";
import NoticeList from "@/components/NoticeList";
import type { Metadata } from "next";
import { getPack } from "@/lib/industry";

export const metadata: Metadata = { title: "Notifications" };

export default async function CustomerNotificationsPage() {
  const [notices, pack] = await Promise.all([listNotifications(), getPack()]);
  return (
    <>
      <PageHead title="Notifications" sub={pack.shop ? "Replies from our team, order updates and return progress." : `Replies from ${pack.org} staff about your enquiries.`} />
      <NoticeList notices={notices} />
    </>
  );
}
