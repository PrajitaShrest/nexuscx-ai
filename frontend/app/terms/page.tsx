import LegalPage from "@/components/LegalPage";
import { getChosenIndustry } from "@/lib/industry";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms" };

// Each organisation on the platform has its own terms (store or Northbridge University)
export default async function TermsPage() {
  const uni = (await getChosenIndustry()) === "university";
  return (
    <LegalPage title={uni ? "Northbridge Student Help: Terms of Use" : "NexusCX Store: Terms of Use"} updated="3 November 2026" industry={uni ? "university" : "ecommerce"}>
      {uni ? (
        <section><h2>Using Student Help</h2><p>Northbridge students and applicants can use Student Help to ask about admissions, fees, IT, exams and results, and student services. You must use your own account, and the details you give us must be true.</p></section>
      ) : (
        <section><h2>Using the help centre</h2><p>You can use the NexusCX Store help centre to ask for help with your orders, returns, billing and technical problems. You must be at least 10 years old to create an account, and the details you give us must be true.</p></section>
      )}
      <section><h2>How answers are made</h2><p>
        Many replies are written by AI using only {uni ? "information approved by Northbridge University staff" : "our approved company documents"}. Each AI answer shows its source and who to contact.
        {uni
          ? " Wellbeing concerns, personal visa questions, special consideration, academic integrity, grade appeals and refunds are always handled by a person."
          : " Requests about refunds, account changes or anything high-risk are always handled by a person."}
      </p></section>
      {uni && (
        <section><h2>Not personal advice</h2><p>The AI gives general information only. It does not give personal visa, migration, legal, medical or financial advice. For your own situation, the right Northbridge team (or a registered migration agent for visas) will help you. If you are in danger, call 000.</p></section>
      )}
      <section><h2>Your account</h2><ul>
        <li>Keep your password private.</li>
        <li>We lock an account for 15 minutes after 5 wrong passwords, to protect it.</li>
        <li>Don&apos;t try to make the AI ignore its rules. These attempts are blocked and recorded.</li>
        <li>Your account belongs to {uni ? "Northbridge University" : "NexusCX Store"} only. It cannot be used for another organisation on the platform.</li>
      </ul></section>
      <section><h2>Changes</h2><p>We may update these terms. We&apos;ll show the date of the latest change at the top of this page.</p></section>
    </LegalPage>
  );
}
