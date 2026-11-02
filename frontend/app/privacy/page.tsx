import LegalPage from "@/components/LegalPage";
import { getChosenIndustry } from "@/lib/industry";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy" };

// Each organisation on the platform has its own privacy policy (store or Northbridge University)
export default async function PrivacyPage() {
  const uni = (await getChosenIndustry()) === "university";
  const team = uni ? "Student Services" : "our Customer Care team";
  return (
    <LegalPage title={uni ? "Northbridge Student Help: Privacy Policy" : "NexusCX Store: Privacy Policy"} updated="3 November 2026" industry={uni ? "university" : "ecommerce"}>
      <section><h2>What we collect</h2><ul>
        <li>Your name, username, email and date of birth.</li>
        <li>Your mobile number, if you choose to give it.</li>
        <li>The messages you send us, our replies, and any files you upload{uni ? " (for example a medical certificate)" : " (for example photos of a damaged item)"}.</li>
      </ul></section>
      <section><h2>Why we collect it</h2><p>To sign you in, to answer your {uni ? "enquiries" : "requests"}, and to check you meet the minimum age. We use your mobile only to contact you about your own {uni ? "enquiries" : "requests"}.</p></section>
      <section><h2>How we protect it</h2><ul>
        <li>Passwords are stored only as a secure hash. Nobody, including our staff, can read them.</li>
        <li>You can only see your own {uni ? "enquiries" : "requests"}. Staff see them only when their role allows it, and only staff of {uni ? "Northbridge University" : "NexusCX Store"}.</li>
        {uni && <li>Sensitive topics (wellbeing, visas, special consideration) are seen only by the staff who handle them, and are never answered by AI alone.</li>}
        <li>Card numbers in messages are hidden automatically.</li>
        <li>Every action by staff and AI is recorded in an audit log.</li>
      </ul></section>
      <section><h2>Your choices</h2><p>You can update your name in your profile. To close your account, contact {team}.</p></section>
    </LegalPage>
  );
}
