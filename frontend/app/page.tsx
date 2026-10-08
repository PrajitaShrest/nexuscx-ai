import { redirect } from "next/navigation";
import { getMe, isStaff, can } from "@/lib/data/me";

// Home: send each user to the first screen their roles allow.
export default async function Home() {
  const me = await getMe();
  if (!isStaff(me)) redirect("/support");
  if (can(me, "view_cases")) redirect("/conversations");
  if (can(me, "manage_users")) redirect("/users");
  redirect("/profile");
}
