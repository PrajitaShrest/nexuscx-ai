// Forms and service requests (migration 026), shared by the browser and the server.
// The database checks every form again; these checks are here so people see a
// mistake the moment they make it, in plain words, next to the field.

export type FieldDef = {
  name: string;
  label: string;
  type: "text" | "textarea" | "date" | "select" | "checkbox" | "photo";
  required?: boolean;
  help?: string;
  prefill?: "name" | "email" | "phone" | "date_of_birth" | "student_number";
  readonly?: boolean;
  max?: number;
  pattern?: string;
  pattern_msg?: string;
  upper?: boolean;
  options?: string[];
  options_from?: "open_orders";
  rule?: "past" | "today_or_future";
  show_if?: { field: string; in: string[] };
};

export type RequestType = {
  type_key: string;
  title: string;
  summary: string;
  team_name: string;
  icon: string;
  keywords: string;
  fields: FieldDef[];
  sla_hours: number;
  fee_note: string | null;
};

export type Prefill = {
  name?: string; email?: string; phone?: string | null; date_of_birth?: string | null; student_number?: string | null;
  open_orders?: { value: string; label: string }[];
};

export type Values = Record<string, string | boolean>;

export const REQUEST_STATUS: Record<string, { label: string; style: string; step: number }> = {
  submitted: { label: "Sent", style: "bg-sky-50 text-sky-700 ring-sky-200", step: 1 },
  in_review: { label: "Being checked", style: "bg-indigo-50 text-indigo-700 ring-indigo-200", step: 2 },
  needs_info: { label: "Needs your changes", style: "bg-amber-50 text-amber-800 ring-amber-200", step: 2 },
  ready: { label: "Ready to collect", style: "bg-emerald-50 text-emerald-700 ring-emerald-200", step: 3 },
  completed: { label: "Done", style: "bg-emerald-50 text-emerald-700 ring-emerald-200", step: 4 },
  rejected: { label: "Not approved", style: "bg-rose-50 text-rose-700 ring-rose-200", step: 4 },
  cancelled: { label: "Cancelled", style: "bg-slate-100 text-slate-600 ring-slate-200", step: 0 },
};
// Staff see the same statuses in their own words
export const STAFF_STATUS: Record<string, string> = {
  submitted: "New", in_review: "Checking", needs_info: "Waiting for changes", ready: "Ready to collect",
  completed: "Done", rejected: "Rejected", cancelled: "Cancelled",
};

export const isOpen = (status: string) => ["submitted", "in_review", "needs_info"].includes(status);

export function visible(f: FieldDef, values: Values) {
  return !f.show_if || f.show_if.in.includes(String(values[f.show_if.field] ?? ""));
}

export function optionsFor(f: FieldDef, prefill: Prefill): { value: string; label: string }[] {
  if (f.options_from) return prefill[f.options_from] ?? [];
  return (f.options ?? []).map((o) => ({ value: o, label: o }));
}

// The starting values: profile details where the form asks for them
export function startValues(type: RequestType, prefill: Prefill, saved?: Values): Values {
  const v: Values = {};
  for (const f of type.fields) {
    if (f.type === "photo") continue;
    const p = f.prefill ? prefill[f.prefill] : undefined;
    if (f.readonly) v[f.name] = String(p ?? "");
    else if (saved && saved[f.name] !== undefined) v[f.name] = f.type === "checkbox" ? false : saved[f.name];
    else if (f.type === "checkbox") v[f.name] = false;
    else if (p) v[f.name] = String(p);
    else if (f.type === "select" && f.options_from) {
      const opts = optionsFor(f, prefill);
      v[f.name] = opts.length === 1 ? opts[0].value : "";
    } else v[f.name] = "";
  }
  return v;
}

const today = () => new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

// Same rules as private.check_request_details in the database
export function checkField(f: FieldDef, values: Values, prefill: Prefill): string | null {
  if (!visible(f, values) || f.type === "photo" || f.readonly) return null;
  const raw = values[f.name];
  const label = f.label.replace(/[?.]+$/, "");
  if (f.type === "checkbox") return f.required && raw !== true ? "Please tick this box to continue." : null;
  let v = String(raw ?? "").trim();
  if (f.upper) v = v.replace(/\s/g, "").toUpperCase();
  if (!v) return f.required ? (f.type === "select" ? "Please choose one." : "Please fill this in.") : null;
  if (v.length > (f.max ?? 200)) return `Please keep this under ${f.max ?? 200} characters.`;
  if (f.type === "select" && !optionsFor(f, prefill).some((o) => o.value === v)) return "Please choose one of the options.";
  if (f.type === "date") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) return "Please enter a real date.";
    const t = today();
    if (f.rule === "past" && (v >= t || Number(v.slice(0, 4)) < Number(t.slice(0, 4)) - 100)) return "This must be a date in the past.";
    if (f.rule === "today_or_future") {
      const max = new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10);
      if (v < t || v > max) return "Choose a date between today and 90 days from now.";
    }
  }
  if (f.pattern && !new RegExp(f.pattern).test(v)) return f.pattern_msg ?? `Please check ${label.toLowerCase()}.`;
  return null;
}

// Extra checks for a whole form (things that depend on two fields)
export function checkForm(type: RequestType, values: Values, prefill: Prefill): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of type.fields) {
    const e = checkField(f, values, prefill);
    if (e) errors[f.name] = e;
  }
  if (type.type_key === "delivery_address" && !errors.postcode && !errors.state && values.postcode && values.state
      && !postcodeMatchesState(String(values.postcode), String(values.state))) {
    errors.postcode = `Postcode ${values.postcode} is not in ${values.state}. Please check the postcode or the state.`;
  }
  return errors;
}

export function postcodeMatchesState(postcode: string, state: string) {
  const n = Number(postcode);
  const act = (n >= 2600 && n <= 2619) || (n >= 2900 && n <= 2920);
  switch (state) {
    case "NSW": return postcode.startsWith("2") && !act;
    case "ACT": return act;
    case "VIC": return postcode.startsWith("3");
    case "QLD": return postcode.startsWith("4");
    case "SA": return postcode.startsWith("5");
    case "WA": return postcode.startsWith("6");
    case "TAS": return postcode.startsWith("7");
    case "NT": return postcode.startsWith("0");
    default: return false;
  }
}

// What gets sent: only the fields that are shown, tidied
export function cleanValues(type: RequestType, values: Values): Values {
  const out: Values = {};
  for (const f of type.fields) {
    if (f.type === "photo" || !visible(f, values)) continue;
    const v = values[f.name];
    out[f.name] = f.type === "checkbox" ? v === true : f.upper ? String(v ?? "").replace(/\s/g, "").toUpperCase() : String(v ?? "").trim();
  }
  return out;
}

// Which form a chat message is asking for, if any
export function formForMessage(types: RequestType[], text: string): RequestType | null {
  for (const t of types) {
    try { if (new RegExp(t.keywords, "i").test(text)) return t; } catch { /* a bad pattern never breaks the chat */ }
  }
  return null;
}

export const hoursText = (h: number) => (h <= 8 ? `within ${h} hours` : h <= 24 ? "within 1 business day" : `within ${Math.round(h / 24)} business days`);

// Whether the person chose to collect something in person
export const needsPickup = (details: Values) =>
  ["Digital card + collect a physical card", "Digital letter + printed copy to collect", "Collect from the Student Centre"].includes(String(details.delivery ?? ""));
