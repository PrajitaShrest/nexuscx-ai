import SignupForm from "./SignupForm";
import { getIndustry } from "@/lib/industry";
// Sign-up follows the chosen demo pack: "customer account" or "student account".
export default async function SignupPage() {
  return <SignupForm industry={await getIndustry()} />;
}
