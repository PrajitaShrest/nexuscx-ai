"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { checkForm, cleanValues, hoursText, optionsFor, startValues, visible, type FieldDef, type Prefill, type RequestType, type Values } from "@/lib/forms";
import { fixRequest, sendRequest, type SendResult } from "@/app/(customer)/account/requests/actions";
import { DigitalCard } from "./Outcome";
import { CheckIcon, PlusIcon, ShieldIcon } from "@/components/Icons";

const field = "w-full rounded-xl border bg-white px-3 py-2.5 text-[15px] outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-500";
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

type Photo = { path: string; preview: string; warnings: string[] };

// Checks a photo in the browser before it is sent: type, size, shape, brightness.
// Size and type stop the upload; shape and brightness only warn (staff decide).
async function inspect(file: File): Promise<{ error?: string; warnings: string[] }> {
  if (!TYPES[file.type]) return { error: "Please use a JPG, PNG or WebP photo.", warnings: [] };
  if (file.size > 5 * 1024 * 1024) return { error: "This photo is over 5 MB. Please use a smaller one.", warnings: [] };
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
    if (img.naturalWidth < 300 || img.naturalHeight < 300) return { error: "This photo is too small. Please use one at least 300 × 300 pixels.", warnings: [] };
    const warnings: string[] = [];
    if (img.naturalWidth > img.naturalHeight * 1.15) warnings.push("This photo is wider than it is tall. A head-and-shoulders photo works best.");
    const c = document.createElement("canvas");
    c.width = 40; c.height = 40;
    const ctx = c.getContext("2d");
    if (ctx) {
      ctx.drawImage(img, 0, 0, 40, 40);
      const px = ctx.getImageData(0, 0, 40, 40).data;
      let sum = 0;
      for (let i = 0; i < px.length; i += 4) sum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      const avg = sum / (px.length / 4);
      if (avg < 70) warnings.push("This photo looks quite dark. A brighter photo is more likely to be accepted first time.");
      if (avg > 235) warnings.push("This photo looks very bright or washed out.");
    }
    return { warnings };
  } catch {
    return { error: "This file could not be opened as a photo.", warnings: [] };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function PhotoField({ f, photo, setPhoto, error, savedUrl }: { f: FieldDef; photo: Photo | null; setPhoto: (p: Photo | null) => void; error?: string; savedUrl?: string | null }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const input = useRef<HTMLInputElement>(null);
  async function pick(file?: File) {
    setProblem("");
    if (!file) return;
    const check = await inspect(file);
    if (check.error) { setProblem(check.error); return; }
    setBusy(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); setProblem("Please sign in again to add a photo."); return; }
    const path = `${user.id}/${crypto.randomUUID()}.${TYPES[file.type]}`;
    const { error: e } = await supabase.storage.from("request-photos").upload(path, file, { contentType: file.type, upsert: false });
    setBusy(false);
    if (e) { setProblem("The photo could not be uploaded. Please try again."); return; }
    setPhoto({ path, preview: URL.createObjectURL(file), warnings: check.warnings });
    if (input.current) input.current.value = "";
  }
  const shown = photo?.preview ?? savedUrl ?? null;
  return (
    <div>
      <p className="mb-1 text-sm font-medium">{f.label}{f.required && <span className="text-rose-600"> *</span>}</p>
      <div className="flex flex-wrap items-start gap-4">
        <div className="h-32 w-28 shrink-0 overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-slate-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {shown ? <img src={shown} alt="Your photo" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center p-2 text-center text-xs text-muted">No photo yet</span>}
        </div>
        <div className="min-w-0 flex-1 space-y-2 text-sm">
          {f.help && <p className="text-muted">{f.help}</p>}
          <ul className="space-y-0.5 text-xs text-muted">
            <li>✓ Face and shoulders, looking at the camera</li><li>✓ Plain, light background</li><li>✓ JPG, PNG or WebP, under 5 MB</li>
          </ul>
          <label className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border border-indigo-300 bg-indigo-50 px-3 py-2 font-semibold text-indigo-700 hover:bg-indigo-100 ${busy ? "pointer-events-none opacity-60" : ""}`}>
            <PlusIcon className="h-4 w-4" /> {busy ? "Uploading…" : shown ? "Change photo" : "Add photo"}
            <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" capture="user" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} disabled={busy} />
          </label>
        </div>
      </div>
      {photo?.warnings.map((w) => <p key={w} className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">{w}</p>)}
      {(problem || error) && <p role="alert" className="mt-2 text-sm text-bad">{problem || error}</p>}
    </div>
  );
}

function Input({ f, value, set, prefill, error, onBlur }: { f: FieldDef; value: string | boolean; set: (v: string | boolean) => void; prefill: Prefill; error?: string; onBlur: () => void }) {
  const id = `f-${f.name}`;
  const ring = error ? "border-rose-400" : "border-slate-300";
  const help = f.help && <p id={`${id}-help`} className="mt-1 text-xs text-muted">{f.help}</p>;
  const err = error && <p id={`${id}-err`} role="alert" className="mt-1 text-sm text-bad">{error}</p>;
  const described = [f.help ? `${id}-help` : "", error ? `${id}-err` : ""].filter(Boolean).join(" ") || undefined;
  if (f.type === "checkbox") {
    return (
      <div>
        <label className={`flex items-start gap-3 rounded-xl border p-3 text-sm ${error ? "border-rose-300 bg-rose-50/50" : "border-slate-200 bg-slate-50/60"}`}>
          <input id={id} type="checkbox" checked={value === true} onChange={(e) => set(e.target.checked)} className="mt-0.5 h-5 w-5 accent-indigo-600" aria-describedby={described} />
          <span>{f.label}</span>
        </label>
        {err}
      </div>
    );
  }
  const label = (
    <label htmlFor={id} className="mb-1 flex items-center gap-2 text-sm font-medium">
      {f.label}{f.required && !f.readonly && <span className="text-rose-600">*</span>}
      {f.readonly && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">From your account</span>}
    </label>
  );
  if (f.type === "select") {
    return (
      <div>{label}
        <select id={id} value={String(value)} onChange={(e) => set(e.target.value)} onBlur={onBlur} className={`${field} ${ring}`} aria-invalid={!!error} aria-describedby={described}>
          <option value="">Choose…</option>
          {optionsFor(f, prefill).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {f.options_from && optionsFor(f, prefill).length === 0 && <p className="mt-1 text-sm text-amber-800">You have no orders that can still be changed.</p>}
        {help}{err}
      </div>
    );
  }
  if (f.type === "textarea") {
    return <div>{label}<textarea id={id} rows={3} maxLength={f.max ?? 200} value={String(value)} onChange={(e) => set(e.target.value)} onBlur={onBlur} className={`${field} ${ring}`} aria-invalid={!!error} aria-describedby={described} />{help}{err}</div>;
  }
  return (
    <div>{label}
      <input id={id} type={f.type === "date" ? "date" : "text"} value={String(value)} readOnly={f.readonly} disabled={f.readonly}
        maxLength={f.max ?? 200} onChange={(e) => set(f.upper ? e.target.value.toUpperCase() : e.target.value)} onBlur={onBlur}
        className={`${field} ${ring} ${f.upper ? "font-mono tracking-wider" : ""}`} aria-invalid={!!error} aria-describedby={described}
        autoComplete={f.prefill === "name" ? "name" : f.prefill === "phone" ? "tel" : f.name === "postcode" ? "postal-code" : f.name === "line1" ? "address-line1" : undefined} />
      {help}{err}
    </div>
  );
}

// The form for one request type: filled in from the person's profile, checked as they type,
// then a review step, then sent. mode "fix" = sending the changes staff asked for.
export default function RequestForm({ type, prefill, mode = "new", requestId, saved, savedPhotoUrl, compact, onSent }: {
  type: RequestType; prefill: Prefill; mode?: "new" | "fix"; requestId?: string; saved?: Values; savedPhotoUrl?: string | null; compact?: boolean;
  onSent?: (r: SendResult) => void;
}) {
  const [values, setValues] = useState<Values>(() => startValues(type, prefill, saved));
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [step, setStep] = useState<"fill" | "review" | "sent">("fill");
  const [tried, setTried] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);
  const [pending, start] = useTransition();
  const top = useRef<HTMLDivElement>(null);

  const photoField = type.fields.find((f) => f.type === "photo");
  const errors = useMemo(() => {
    const e = checkForm(type, values, prefill);
    if (photoField?.required && !photo && !(mode === "fix" && savedPhotoUrl)) e[photoField.name] = "Please add your photo.";
    return e;
  }, [type, values, prefill, photo, photoField, mode, savedPhotoUrl]);
  const shown = (name: string) => (tried || touched[name] ? errors[name] : undefined);
  const fields = type.fields.filter((f) => visible(f, values));
  const filled = fields.filter((f) => !errors[f.name]).length;
  const set = (name: string) => (v: string | boolean) => setValues((p) => ({ ...p, [name]: v }));

  function review() {
    setTried(true);
    if (Object.keys(errors).length > 0) {
      const first = type.fields.find((f) => errors[f.name]);
      document.getElementById(`f-${first?.name}`)?.focus();
      return;
    }
    setStep("review");
    top.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function send() {
    start(async () => {
      const clean = cleanValues(type, values);
      const r = mode === "fix" && requestId ? await fixRequest(requestId, clean, photo?.path ?? null) : await sendRequest(type.type_key, clean, photo?.path ?? null);
      setResult(r);
      if (r.ok) { setStep("sent"); onSent?.(r); }
    });
  }

  const isCard = type.type_key === "id_card";
  const summary = fields.filter((f) => f.type !== "photo" && f.type !== "checkbox" && String(values[f.name] ?? "") !== "");

  if (step === "sent" && result?.ok && result.status === "completed") {
    return (
      <div ref={top} className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-950">
        <p className="flex items-center gap-2 text-base font-bold"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white"><CheckIcon className="h-4 w-4" /></span>
          Your {type.title.toLowerCase()} is ready</p>
        <p>Issued instantly ({result.request_number}). Your enrolment was confirmed from your student record, so nobody needed to check it by hand.</p>
        {result.request_id && <Link href={`/account/requests/${result.request_id}`} className="inline-block rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700">Open and download your letter →</Link>}
      </div>
    );
  }

  if (step === "sent" && result?.ok) {
    return (
      <div ref={top} className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-950">
        <p className="flex items-center gap-2 text-base font-bold"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white"><CheckIcon className="h-4 w-4" /></span>
          {mode === "fix" ? "Changes sent" : `Request ${result.request_number} sent`}</p>
        <p>Every detail was checked before sending, so it is ready for the {type.team_name} team. They usually finish these {hoursText(type.sla_hours)}.</p>
        <p>We&apos;ll notify you when it&apos;s ready{isCard ? ", and your digital card will appear in My requests" : ""}.</p>
        {result.request_id && <Link href={`/account/requests/${result.request_id}`} className="inline-block font-semibold text-indigo-700 hover:underline">Follow this request →</Link>}
      </div>
    );
  }

  return (
    <div ref={top} className={`space-y-5 ${compact ? "" : "rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"}`}>
      {!compact && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold">{mode === "fix" ? `Update your ${type.title.toLowerCase()} request` : type.title}</h2>
            <p className="text-sm text-muted">{type.type_key === "enrolment_letter" ? "Digital letters are issued instantly" : <>Goes to the {type.team_name} team · usually {hoursText(type.sla_hours)}</>}</p>
          </div>
          {step === "fill" && <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">{filled} of {fields.length} done</span>}
        </div>
      )}

      {step === "fill" && (
        <div className={isCard ? "grid gap-6 lg:grid-cols-[1fr_minmax(0,320px)]" : ""}>
          <div className="space-y-4">
            {fields.map((f) => f.type === "photo"
              ? <PhotoField key={f.name} f={f} photo={photo} setPhoto={setPhoto} error={shown(f.name)} savedUrl={mode === "fix" ? savedPhotoUrl : null} />
              : <Input key={f.name} f={f} value={values[f.name] ?? ""} set={set(f.name)} prefill={prefill} error={shown(f.name)}
                  onBlur={() => setTouched((t) => ({ ...t, [f.name]: true }))} />)}
            {type.fee_note && <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-muted">{type.fee_note}</p>}
            {tried && Object.keys(errors).length > 0 && (
              <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                Please fix {Object.keys(errors).length === 1 ? "the field" : `the ${Object.keys(errors).length} fields`} marked in red.
              </p>
            )}
            <button type="button" onClick={review} className="w-full rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-3 font-semibold text-white shadow-md hover:brightness-110 sm:w-auto">
              Check my details
            </button>
          </div>
          {isCard && (
            <aside className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Your card will look like this</p>
              <DigitalCard preview name={String(values.full_name ?? "")} studentNumber={String(values.student_number ?? "")} course={String(values.course ?? "")}
                photoUrl={photo?.preview ?? (mode === "fix" ? savedPhotoUrl ?? null : null)} />
            </aside>
          )}
        </div>
      )}

      {step === "review" && (
        <div className="space-y-4">
          <p className="text-sm text-muted">Please check everything once more. This is what the {type.team_name} team will see.</p>
          <div className={isCard ? "grid gap-6 lg:grid-cols-[1fr_minmax(0,320px)]" : ""}>
            <dl className="divide-y rounded-2xl border border-slate-200 text-sm">
              {summary.map((f) => (
                <div key={f.name} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 px-4 py-2.5">
                  <dt className="text-muted">{f.label.replace(/ \(optional\)$/, "")}</dt>
                  <dd className="font-medium break-words">{f.options_from ? optionsFor(f, prefill).find((o) => o.value === values[f.name])?.label : String(values[f.name])}</dd>
                </div>
              ))}
              {photoField && <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 px-4 py-2.5"><dt className="text-muted">Photo</dt><dd className="font-medium">{photo ? "Added" : "Kept from before"}</dd></div>}
            </dl>
            {isCard && <DigitalCard preview name={String(values.full_name)} studentNumber={String(values.student_number)} course={String(values.course)} photoUrl={photo?.preview ?? savedPhotoUrl ?? null} />}
          </div>
          <p className="flex items-center gap-2 text-xs text-muted"><ShieldIcon className="h-4 w-4" /> Only you and the {type.team_name} team can see this. Every step is recorded.</p>
          {result?.error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{result.error}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={send} disabled={pending}
              className="rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 px-5 py-3 font-semibold text-white shadow-md hover:brightness-110 disabled:opacity-60">
              {pending ? "Sending…" : mode === "fix" ? "Send my changes" : "Send request"}
            </button>
            <button type="button" onClick={() => setStep("fill")} disabled={pending} className="rounded-xl border border-slate-300 px-5 py-3 font-semibold hover:bg-slate-50">Edit details</button>
          </div>
        </div>
      )}
    </div>
  );
}
