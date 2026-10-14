// Shown instantly while a customer page loads (the sidebar stays in place).
export default function Loading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Loading">
      <div className="h-32 rounded-3xl bg-slate-200/70" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-28 rounded-2xl bg-slate-200/70" />)}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="h-72 rounded-3xl bg-slate-200/70 lg:col-span-2" />
        <div className="h-72 rounded-3xl bg-slate-200/70" />
      </div>
    </div>
  );
}
