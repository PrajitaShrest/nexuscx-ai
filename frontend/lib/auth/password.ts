// Password rules shared by the browser (live meter) and the server (final check).

export function passwordProblem(pw: string): string | null {
  if (pw.length < 8) return "Use at least 8 characters.";
  if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) return "Use both letters and numbers.";
  return null;
}

// 0-4 score for the strength meter
export function passwordScore(pw: string): number {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  if (/(.)\1{2,}/.test(pw) || /^(password|qwerty|123456)/i.test(pw)) score = Math.max(0, score - 2);
  return Math.min(4, score);
}

export const STRENGTH = [
  { label: "Too weak", color: "bg-red-500", text: "text-bad" },
  { label: "Weak", color: "bg-orange-500", text: "text-orange-700" },
  { label: "Okay", color: "bg-amber-400", text: "text-amber-700" },
  { label: "Good", color: "bg-lime-500", text: "text-lime-700" },
  { label: "Strong", color: "bg-emerald-600", text: "text-ok" },
];
