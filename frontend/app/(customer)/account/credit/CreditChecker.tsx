"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { previewCredit, submitCredit } from "./actions";
import type { CreditResult, PriorUnit } from "@/lib/data/requests";
import { COURSES, finishWith } from "@/lib/transcript";
import { completion } from "@/components/requests/Outcome";
import { BotIcon, CheckIcon, PlusIcon, ShieldIcon, XIcon } from "@/components/Icons";

const INTAKES = ["February 2024", "July 2024", "February 2025", "July 2025", "February 2026", "July 2026"];
const GRADES = [["HD", "HD (High Distinction)"], ["D", "D (Distinction)"], ["C", "C (Credit)"], ["P", "P (Pass)"], ["N", "N (Fail)"]];
const YEARS = Array.from({ length: 16 }, (_, i) => String(new Date().getFullYear() - i));
const field = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100";
const empty = (): PriorUnit => ({ name: "", code: "", grade: "", year: "" });

const SAMPLE = `COMP1001  Programming Fundamentals     D   2024
COMP1003  Database Design              C   2024
COMP1004  Computer Networks            P   2023
COMP1005  Web Technologies             HD  2024
HUMN1001  Professional Communication   72  2023
MATH1006  Discrete Maths               78  2024
INFO2001  Systems Analysis             P   2024
COMP2001  Object Oriented Programming  F   2024
PSYC1001  Introduction to Psychology   D   2023`;

// Reads units from text copied out of a transcript: one unit per line, with
// a unit code, a name, a grade or mark, and a year, in any order.
function readTranscript(text: string): PriorUnit[] {
  return text.split(/\n+/).map((line) => {
    let rest = ` ${line.trim()} `;
    const code = rest.match(/\b[A-Z]{2,5}\s?\d{3,4}[A-Z]?\b/)?.[0] ?? "";
    rest = rest.replace(code, " ");
    const year = rest.match(/\b(19|20)\d{2}\b/)?.[0] ?? "";
    rest = rest.replace(year, " ");
    let grade = rest.match(/\s(HD|DN|D|CR|C|P|PASS|N|F|FAIL)\s/i)?.[1]?.toUpperCase() ?? "";
    if (grade) rest = rest.replace(new RegExp(`\\s${grade}\\s`, "i"), " ");
    const mark = rest.match(/\b(\d{1,3})(\.\d+)?\s*%?\s/)?.[1];
    if (!grade && mark) {
      const m = Number(mark);
      grade = m >= 85 ? "HD" : m >= 75 ? "D" : m >= 65 ? "C" : m >= 50 ? "P" : "N";
      rest = rest.replace(mark, " ");
    }
    if (grade === "DN") grade = "D"; if (grade === "CR") grade = "C"; if (grade === "PASS") grade = "P"; if (grade === "F" || grade === "FAIL") grade = "N";
    const name = rest.replace(/[|,;\t]+/g, " ").replace(/\s+/g, " ").trim();
    return { name, code: code.replace(/\s/g, ""), grade, year };
  }).filter((u) => u.name.length >= 3);
}

const BADGE: Record<string, string> = {
  granted: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  review: "bg-amber-50 text-amber-800 ring-amber-200",
  none: "bg-slate-100 text-slate-600 ring-slate-200",
};
const LABEL: Record<string, string> = { granted: "Approved", review: "Assessor checks", none: "No credit" };

export default function CreditChecker({ name }: { name: string }) {
  const router = useRouter();
  const [course, setCourse] = useState("");
  const [intake, setIntake] = useState("");
  const [load, setLoad] = useState("Full-time");
  const [institution, setInstitution] = useState("");
  const [qualification, setQualification] = useState("");
  const [units, setUnits] = useState<PriorUnit[]>([empty(), empty(), empty()]);
  const [paste, setPaste] = useState("");
  const [doc, setDoc] = useState<{ path: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<CreditResult | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const filled = units.filter((u) => u.name.trim().length >= 3);
  const missing = filled.filter((u) => !u.grade || !u.year).length;
  const ready = course && intake && institution.trim().length >= 2 && filled.length > 0 && missing === 0;
  const input = { course, intake, load, institution, qualification, units: filled, document: doc?.path ?? null };
  const setUnit = (i: number, k: keyof PriorUnit, v: string) => { setUnits((all) => all.map((u, j) => (j === i ? { ...u, [k]: v } : u))); setResult(null); };

  function read(text: string) {
    const found = readTranscript(text);
    if (found.length === 0) { setError("I couldn't find any units in that text. Put one unit on each line, with its name, grade and year."); return; }
    setError(""); setUnits(found); setResult(null);
  }
  async function upload(file?: File) {
    if (!file) return;
    if (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) {
      setError("Please use a PDF or photo of your transcript under 10 MB."); return;
    }
    setUploading(true); setError("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploading(false); setError("Please sign in again."); return; }
    const ext = file.type === "application/pdf" ? "pdf" : file.type.split("/")[1].replace("jpeg", "jpg");
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error: e } = await supabase.storage.from("request-documents").upload(path, file, { contentType: file.type });
    setUploading(false);
    if (e) { setError("Your transcript could not be uploaded. Please try again."); return; }
    setDoc({ path, name: file.name });
  }
  const check = () => start(async () => { setError(""); const r = await previewCredit(input); if (r.error) setError(r.error); else setResult(r.result ?? null); });
  const apply = () => start(async () => { setError(""); const r = await submitCredit(input); if (r.error) setError(r.error); else if (r.request_id) router.push(`/account/requests/${r.request_id}`); });

  const before = course && intake ? completion(course, intake, load) : null;
  const after = result && course && intake ? finishWith(course, intake, load, result.granted_units + result.review_units) : null;
  const afterSure = result && course && intake ? finishWith(course, intake, load, result.granted_units) : null;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="font-bold">1. Your Northbridge course</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="text-sm"><span className="mb-1 block font-medium">Course</span>
            <select value={course} onChange={(e) => { setCourse(e.target.value); setResult(null); }} className={field}><option value="">Choose…</option>{COURSES.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="text-sm"><span className="mb-1 block font-medium">When you started</span>
            <select value={intake} onChange={(e) => { setIntake(e.target.value); setResult(null); }} className={field}><option value="">Choose…</option>{INTAKES.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="text-sm"><span className="mb-1 block font-medium">Study load</span>
            <select value={load} onChange={(e) => { setLoad(e.target.value); setResult(null); }} className={field}><option>Full-time</option><option>Part-time</option></select></label>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="font-bold">2. Where you studied before</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm"><span className="mb-1 block font-medium">University, TAFE or college</span>
            <input value={institution} onChange={(e) => setInstitution(e.target.value)} maxLength={100} placeholder="e.g. Western Sydney University" className={field} /></label>
          <label className="text-sm"><span className="mb-1 block font-medium">Course or qualification (optional)</span>
            <input value={qualification} onChange={(e) => setQualification(e.target.value)} maxLength={100} placeholder="e.g. Bachelor of Computing (not finished)" className={field} /></label>
        </div>
        <div className="mt-3 text-sm">
          <span className="mb-1 block font-medium">Your transcript (optional, PDF or photo)</span>
          <label className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border border-indigo-300 bg-indigo-50 px-3 py-2 font-semibold text-indigo-700 hover:bg-indigo-100 ${uploading ? "pointer-events-none opacity-60" : ""}`}>
            <PlusIcon className="h-4 w-4" /> {uploading ? "Uploading…" : doc ? "Change file" : "Add transcript"}
            <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
          </label>
          {doc && <span className="ml-3 text-emerald-700">✓ {doc.name}</span>}
          <p className="mt-1 text-xs text-muted">Kept with your application as evidence. Only you and Academic Services can see it.</p>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">3. Units you passed</h2>
          <button type="button" onClick={() => { setPaste(SAMPLE); read(SAMPLE); }} className="text-sm font-semibold text-indigo-700 hover:underline">Try a sample transcript</button>
        </div>
        <details className="mt-3 rounded-xl border border-dashed border-slate-300 p-3 text-sm">
          <summary className="cursor-pointer font-medium">Copy and paste from your transcript (the AI reads it for you)</summary>
          <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={5} placeholder={"One unit per line, for example:\nCOMP1001  Programming Fundamentals  D  2024"} className={`${field} mt-2 font-mono text-xs`} />
          <button type="button" onClick={() => read(paste)} disabled={paste.trim().length < 5} className="mt-2 rounded-lg bg-indigo-600 px-3 py-1.5 font-semibold text-white disabled:opacity-50">Read my transcript</button>
        </details>

        <div className="mt-3 space-y-2">
          <div className="hidden grid-cols-[minmax(0,3fr)_minmax(0,1.2fr)_minmax(0,1.6fr)_minmax(0,1fr)_32px] gap-2 px-1 text-xs font-medium text-muted sm:grid">
            <span>Unit name</span><span>Code</span><span>Grade</span><span>Year</span><span />
          </div>
          {units.map((u, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-2 sm:grid-cols-[minmax(0,3fr)_minmax(0,1.2fr)_minmax(0,1.6fr)_minmax(0,1fr)_32px] sm:bg-transparent sm:p-0">
              <input aria-label="Unit name" value={u.name} onChange={(e) => setUnit(i, "name", e.target.value)} maxLength={120} placeholder="e.g. Programming Fundamentals" className={`${field} col-span-2 sm:col-span-1`} />
              <input aria-label="Unit code" value={u.code} onChange={(e) => setUnit(i, "code", e.target.value.toUpperCase())} maxLength={12} placeholder="COMP1001" className={`${field} font-mono`} />
              <select aria-label="Grade" value={u.grade} onChange={(e) => setUnit(i, "grade", e.target.value)} className={`${field} ${u.name && !u.grade ? "border-rose-400" : ""}`}>
                <option value="">Grade…</option>{GRADES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <select aria-label="Year finished" value={u.year} onChange={(e) => setUnit(i, "year", e.target.value)} className={`${field} ${u.name && !u.year ? "border-rose-400" : ""}`}>
                <option value="">Year…</option>{YEARS.map((y) => <option key={y}>{y}</option>)}
              </select>
              <button type="button" aria-label={`Remove unit ${i + 1}`} onClick={() => { setUnits((all) => all.filter((_, j) => j !== i)); setResult(null); }}
                className="flex h-9 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"><XIcon className="h-4 w-4" /></button>
            </div>
          ))}
          <button type="button" onClick={() => setUnits((all) => [...all, empty()])} className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-700 hover:underline"><PlusIcon className="h-4 w-4" /> Add a unit</button>
        </div>
        {missing > 0 && <p className="mt-2 text-sm text-amber-800">Add a grade and year for {missing === 1 ? "1 unit" : `${missing} units`} (marked in red).</p>}
        <button type="button" onClick={check} disabled={!ready || pending}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 px-5 py-3 font-semibold text-white shadow-md hover:brightness-110 disabled:opacity-50">
          <BotIcon className="h-5 w-5" /> {pending && !result ? "Checking…" : "Check my credit"}
        </button>
      </section>

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}

      {result && (
        <section className="space-y-4 rounded-3xl border border-indigo-200 bg-white p-5 shadow-sm sm:p-6" aria-live="polite">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white"><BotIcon className="h-5 w-5" /></span>
            <div>
              <h2 className="text-lg font-bold">Your credit, {name.split(" ")[0]}</h2>
              <p className="text-sm text-muted">Checked against the {result.course} by the AI Credit Assessor, using Northbridge&apos;s credit rules.</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-emerald-50 p-4"><p className="text-xs font-semibold uppercase text-emerald-700">Approved now</p><p className="text-2xl font-bold text-emerald-800">{result.granted_units} unit{result.granted_units === 1 ? "" : "s"}</p><p className="text-xs text-emerald-800">{result.granted_points} credit points</p></div>
            <div className="rounded-2xl bg-amber-50 p-4"><p className="text-xs font-semibold uppercase text-amber-800">Assessor checks</p><p className="text-2xl font-bold text-amber-900">{result.review_units} unit{result.review_units === 1 ? "" : "s"}</p><p className="text-xs text-amber-900">{result.review_units ? "usually within 2 business days" : "nothing to check"}</p></div>
            <div className="rounded-2xl bg-indigo-50 p-4"><p className="text-xs font-semibold uppercase text-indigo-700">Expected finish</p><p className="text-2xl font-bold text-indigo-900">{afterSure ?? "—"}</p><p className="text-xs text-indigo-900">{before && afterSure !== before ? `instead of ${before}` : "same as before"}{after && after !== afterSure ? ` · ${after} if all approved` : ""}</p></div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b text-xs text-muted"><tr><th className="py-2 pr-3 font-medium">Your unit</th><th className="py-2 pr-3 font-medium">Northbridge unit</th><th className="py-2 pr-3 font-medium">Decision</th><th className="py-2 font-medium">Why</th></tr></thead>
              <tbody className="divide-y">
                {result.units.map((u, i) => (
                  <tr key={i} className="align-top">
                    <td className="py-2 pr-3"><span className="font-medium">{u.name}</span><span className="block text-xs text-muted">{[u.code, u.grade, u.year].filter(Boolean).join(" · ")}</span></td>
                    <td className="py-2 pr-3">{u.nb_code ? <><span className="font-mono text-xs">{u.nb_code}</span><span className="block">{u.nb_name}</span></> : <span className="text-muted">—</span>}</td>
                    <td className="py-2 pr-3"><span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${BADGE[u.decision]}`}>{u.decision === "granted" && <CheckIcon className="h-3 w-3" />}{LABEL[u.decision]}</span></td>
                    <td className="py-2 text-muted">{u.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="flex items-center gap-2 text-xs text-muted"><ShieldIcon className="h-4 w-4" /> Rules: passed units from the last 10 years that match a unit in your course, up to half of the course. Every decision is recorded.</p>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={apply} disabled={pending || (result.granted_units + result.review_units) === 0}
              className="rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 px-5 py-3 font-semibold text-white shadow-md hover:brightness-110 disabled:opacity-50">
              {pending ? "Applying…" : "Apply for this credit"}
            </button>
            <span className="text-sm text-muted">{result.review_units ? "Approved units are confirmed straight away; the assessor only checks the rest." : "Your credit is confirmed straight away. No waiting."}</span>
          </div>
        </section>
      )}
    </div>
  );
}
