export default function FormMessage({ error, ok }: { error?: string; ok?: string }) {
  if (error) return <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-bad">{error}</p>;
  if (ok) return <p role="status" className="rounded-lg border border-green-200 bg-green-50 px-3.5 py-3 text-sm text-ok">{ok}</p>;
  return null;
}
