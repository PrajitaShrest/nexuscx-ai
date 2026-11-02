import Link from "next/link";
import { listMyChats } from "@/lib/data/shop";
import { PageHead } from "@/components/CustomerShell";
import { btnPrimary } from "@/components/ShopUI";
import ChatList from "./ChatList";
import type { Metadata } from "next";
import { getPack } from "@/lib/industry";

export const metadata: Metadata = { title: "Chat history" };

export default async function ChatsPage() {
  const [chats, pack] = await Promise.all([listMyChats(), getPack()]);
  return (
    <>
      <PageHead title="Chat history" sub={`Every conversation with the ${pack.assistant} and our team, in one place.`}
        action={<Link href="/support" className={btnPrimary}>New chat</Link>} />
      <ChatList chats={chats} shop={pack.shop} staffName={pack.shop ? "Support team" : `${pack.org} staff`} />
    </>
  );
}
