import LegalPage from "@/components/LegalPage";

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="8 October 2026">
      <section><h2>What we collect</h2><ul><li>Your name, username, email and date of birth.</li><li>Your mobile number, if you choose to give it.</li><li>The messages you send us and our replies.</li></ul></section>
      <section><h2>Why we collect it</h2><p>To sign you in, to answer your requests, and to check you meet the minimum age. We use your mobile only to contact you about your own requests.</p></section>
      <section><h2>How we protect it</h2><ul><li>Passwords are stored only as a secure hash. Nobody, including our staff, can read them.</li><li>You can only see your own requests. Staff see requests only when their role allows it.</li><li>Card numbers in messages are hidden automatically.</li><li>Every action by staff and AI is recorded in an audit log.</li></ul></section>
      <section><h2>Your choices</h2><p>You can update your name in your profile. To close your account, contact our support team.</p></section>
    </LegalPage>
  );
}
