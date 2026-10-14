"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

// A row of dropdown filters stored in the page address (?days=30&topic=billing),
// so a filtered view can be bookmarked or shared. Changing one reloads the data.
export type FilterDef = { name: string; label: string; options: [string, string][] };

export default function FilterBar({ filters, keep = [], search }: { filters: FilterDef[]; keep?: string[]; search?: { name: string; label: string; placeholder: string } }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  function set(name: string, value: string) {
    const next = new URLSearchParams();
    for (const k of [...keep, ...filters.map((f) => f.name), ...(search ? [search.name] : [])]) { const v = params.get(k); if (v) next.set(k, v); }
    if (value) next.set(name, value); else next.delete(name);
    start(() => router.replace(`${path}${next.size ? `?${next}` : ""}`, { scroll: false }));
  }
  const active = filters.some((f) => params.get(f.name) && f.name !== "days") || (!!search && !!params.get(search.name));

  return (
    <div className={`flex flex-wrap items-end gap-3 transition-opacity ${pending ? "opacity-60" : ""}`} aria-busy={pending}>
      {search && (
        <form className="text-xs font-semibold text-gray-500" onSubmit={(e) => { e.preventDefault(); set(search.name, String(new FormData(e.currentTarget).get("q") ?? "").trim()); }}>
          <label htmlFor="filter-search">{search.label}</label>
          <input id="filter-search" name="q" type="search" key={params.get(search.name) ?? ""} defaultValue={params.get(search.name) ?? ""} placeholder={search.placeholder}
            className="mt-1 block w-56 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm font-normal text-gray-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" />
        </form>
      )}
      {filters.map((f) => (
        <label key={f.name} className="text-xs font-semibold text-gray-500">
          {f.label}
          <select value={params.get(f.name) ?? ""} onChange={(e) => set(f.name, e.target.value)}
            className="mt-1 block min-w-36 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm font-normal text-gray-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100">
            {f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      ))}
      {active && (
        <button type="button" onClick={() => { const next = new URLSearchParams(); for (const k of ["days", ...keep]) { const v = params.get(k); if (v) next.set(k, v); } start(() => router.replace(`${path}${next.size ? `?${next}` : ""}`, { scroll: false })); }}
          className="rounded-lg px-2.5 py-1.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-50">Clear filters</button>
      )}
    </div>
  );
}
