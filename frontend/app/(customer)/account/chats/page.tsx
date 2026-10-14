import Link from "next/link";
import { listMyChats } from "@/lib/data/shop";
import { PageHead } from "@/components/CustomerShell";
import { btnPrimary } from "@/components/ShopUI";
import ChatList from "./ChatList";

export default async function ChatsPage() {
  const chats = await listMyChats();
  return (
    <>
      <PageHead title="Chat history" sub="Every conversation with our assistant and our team, in one place."
        action={<Link href="/support" className={btnPrimary}>New chat</Link>} />
      <ChatList chats={chats} />
    </>
  );
}
