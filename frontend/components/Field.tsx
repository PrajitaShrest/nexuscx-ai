// A form field with its label, a quiet hint and an error under it.
export default function Field({ label, hint, error, htmlFor, children }: {
  label: string; hint?: string; error?: string; htmlFor: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink">{label}</label>
      <div className="mt-1.5">{children}</div>
      {error ? (
        <p id={`${htmlFor}-error`} className="mt-1.5 text-sm text-bad">{error}</p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="mt-1.5 text-sm text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function inputClass(invalid?: boolean) {
  return `w-full rounded-lg border bg-white px-3.5 py-2.5 text-ink placeholder:text-slate-400 outline-none transition-colors focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 ${
    invalid ? "border-red-400" : "border-slate-300"
  }`;
}
