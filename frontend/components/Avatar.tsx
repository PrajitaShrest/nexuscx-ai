// Round avatar with initials. The colour is picked from the name, so each
// person always gets the same colour. Optional presence dot for staff.
const GRADIENTS = [
  "from-amber-400 to-rose-500", "from-indigo-500 to-violet-600", "from-emerald-400 to-teal-600",
  "from-sky-400 to-indigo-600", "from-fuchsia-500 to-pink-500", "from-orange-400 to-amber-600",
];
export const PRESENCE: Record<string, { label: string; dot: string }> = {
  online: { label: "Online", dot: "bg-emerald-500" },
  busy: { label: "Busy", dot: "bg-rose-500" },
  away: { label: "Away", dot: "bg-amber-400" },
  offline: { label: "Offline", dot: "bg-slate-400" },
};

export function initialsOf(name: string) {
  return name.trim().split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "?";
}

export default function Avatar({ name, size = 36, presence, ring }: { name: string; size?: number; presence?: string; ring?: string }) {
  const g = GRADIENTS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % GRADIENTS.length];
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <span className={`flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br ${g} font-bold text-white ${ring ?? ""}`}
        style={{ fontSize: Math.round(size * 0.38) }}>
        {initialsOf(name)}
      </span>
      {presence && (
        <span title={PRESENCE[presence]?.label}
          className={`absolute bottom-0 right-0 rounded-full ring-2 ring-white ${PRESENCE[presence]?.dot ?? "bg-slate-400"}`}
          style={{ width: Math.max(9, size * 0.28), height: Math.max(9, size * 0.28) }} />
      )}
    </span>
  );
}
