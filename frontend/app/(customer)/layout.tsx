import { redirect } from "next/navigation";
import CustomerShell from "@/components/CustomerShell";
import { getMe, isStaff } from "@/lib/data/me";

// Every page in this group is for customers. Staff are sent to their workspace.
// (Row Level Security also limits customers to their own data.)
export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  if (isStaff(me)) redirect("/");
  return <CustomerShell me={me}>{children}</CustomerShell>;
}
