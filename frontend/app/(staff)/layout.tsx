import { redirect } from "next/navigation";
import { getMe, isStaff } from "@/lib/data/me";

// Every page in this group is for staff. Customers are sent to /support.
// (The database also refuses customers; this check just gives a clean redirect.)
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  if (!isStaff(me)) redirect("/support");
  return <>{children}</>;
}
