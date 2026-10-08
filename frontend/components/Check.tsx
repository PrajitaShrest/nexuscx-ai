// A live rule: a tick when met, a dot when not yet
export default function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className={`flex items-center gap-2 text-sm ${ok ? "text-ok" : "text-muted"}`}>
      <span aria-hidden="true" className="w-4 text-center">{ok ? "✓" : "•"}</span>
      {children}
    </li>
  );
}
