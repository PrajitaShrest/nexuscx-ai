import { Children, cloneElement, isValidElement, type ReactElement } from "react";

// A form field with its label, a quiet hint and an error under it.
// The input inside is linked to the hint/error with aria-describedby and marked
// aria-invalid, so screen readers read the problem when the field gets focus.
export default function Field({ label, hint, error, htmlFor, children }: {
  label: string; hint?: string; error?: string; htmlFor: string; children: React.ReactNode;
}) {
  const describedBy = error ? `${htmlFor}-error` : hint ? `${htmlFor}-hint` : undefined;
  const only = Children.count(children) === 1 ? Children.only(children) : null;
  const control = only && isValidElement(only) && typeof only.type === "string"
    ? cloneElement(only as ReactElement<Record<string, unknown>>, { "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })
    : children;
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink">{label}</label>
      <div className="mt-1.5">{control}</div>
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="mt-1.5 text-sm text-bad">{error}</p>
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
