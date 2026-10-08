// NexusCX mark: a speech bubble whose single path forks in two -
// one route ends at the AI (filled dot), the other at a person (ring).
// It shows the product's promise: AI answers, people step in when it matters.
export function LogoMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" role="img" aria-label="NexusCX" className={className}>
      <path d="M8 4h24a6 6 0 0 1 6 6v15a6 6 0 0 1-6 6H17l-7.5 6.2c-.7.6-1.5.1-1.5-.8V31a6 6 0 0 1-6-6V10a6 6 0 0 1 6-6Z"
        fill="#4f46e5" />
      <path d="M9 17.5h5.5c3.5 0 4.5-5.5 8.5-5.5h4.5M14.5 17.5c3.5 0 4.5 5.5 8.5 5.5h4.5"
        stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="30.5" cy="12" r="2.6" fill="#fff" />
      <circle cx="30.5" cy="23" r="2.3" stroke="#fbbf24" strokeWidth="2.1" />
    </svg>
  );
}

export default function Logo({ tone = "dark", size = 40 }: { tone?: "dark" | "light"; size?: number }) {
  return (
    <span className="inline-flex items-center gap-3">
      <LogoMark size={size} />
      <span className={`text-lg font-bold tracking-tight ${tone === "light" ? "text-white" : "text-ink"}`}>
        Nexus<span className={tone === "light" ? "text-indigo-300" : "text-indigo-600"}>CX</span>
      </span>
    </span>
  );
}
