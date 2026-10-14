// Shown instantly while a staff page loads.
export default function Loading() {
  return (
    <div className="flex min-h-screen bg-gray-50" aria-busy="true" aria-label="Loading">
      <div className="hidden w-64 shrink-0 bg-navy md:block" />
      <div className="flex-1 animate-pulse space-y-4 p-6">
        <div className="h-7 w-48 rounded bg-gray-200" />
        <div className="flex gap-4">{[1, 2, 3].map((i) => <div key={i} className="h-16 w-28 rounded-lg bg-gray-200" />)}</div>
        <div className="h-96 rounded-lg bg-gray-200" />
      </div>
    </div>
  );
}
