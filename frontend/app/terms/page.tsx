import LegalPage from "@/components/LegalPage";

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Use" updated="8 October 2026">
      <section><h2>Using NexusCX</h2><p>You can use NexusCX to ask for help with your orders, billing and technical problems. You must be at least 10 years old to create an account, and the details you give us must be true.</p></section>
      <section><h2>How answers are made</h2><p>Many replies are written by AI using only our approved company documents. Each AI answer shows its source. Requests about refunds, account changes or anything high-risk are always handled by a person.</p></section>
      <section><h2>Your account</h2><ul><li>Keep your password private.</li><li>We lock an account for 15 minutes after 5 wrong passwords, to protect it.</li><li>Don&apos;t try to make the AI ignore its rules. These attempts are blocked and recorded.</li></ul></section>
      <section><h2>Changes</h2><p>We may update these terms. We&apos;ll show the date of the latest change at the top of this page.</p></section>
    </LegalPage>
  );
}
