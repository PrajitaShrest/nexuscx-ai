import { passwordScore, STRENGTH } from "@/lib/auth/password";

// Four-segment bar under the password box
export default function StrengthMeter({ password }: { password: string }) {
  if (!password) return null;
  const score = passwordScore(password);
  const s = STRENGTH[score];
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= score ? s.color : "bg-slate-200"}`} />
        ))}
      </div>
      <p className={`mt-1 text-sm font-medium ${s.text}`}>Password strength: {s.label}</p>
    </div>
  );
}
