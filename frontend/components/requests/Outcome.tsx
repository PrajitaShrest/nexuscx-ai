import { REQUEST_STATUS } from "@/lib/forms";
import type { Values } from "@/lib/forms";
import { CheckIcon } from "@/components/Icons";
import { buildTranscript, finishWith } from "@/lib/transcript";

// What a finished request gives the person: a digital ID card, a letter, a permit,
// or the changed order. Also the status pill and the step tracker.

export function RequestPill({ status, staff }: { status: string; staff?: boolean }) {
  const s = REQUEST_STATUS[status] ?? REQUEST_STATUS.submitted;
  const staffLabel: Record<string, string> = { submitted: "New", in_review: "Checking", needs_info: "Waiting for changes" };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${s.style}`}>{staff ? staffLabel[status] ?? s.label : s.label}</span>;
}

export function RequestSteps({ status, pickup }: { status: string; pickup: boolean }) {
  if (status === "cancelled" || status === "rejected") return null;
  const steps = pickup ? ["Sent", "Being checked", "Ready to collect", "Done"] : ["Sent", "Being checked", "Done"];
  const pos: Record<string, number> = { submitted: 0, in_review: 1, needs_info: 1, ready: 2, completed: steps.length };
  const at = pos[status] ?? 0;
  return (
    <ol className="flex items-center gap-2" aria-label="Progress">
      {steps.map((label, i) => {
        const done = i < at || (i === 0 && at > 0);
        const current = i === at;
        const late = current && status === "needs_info";
        return (
          <li key={label} className="flex flex-1 items-center gap-2" aria-current={current ? "step" : undefined}>
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${done ? "bg-emerald-500 text-white" : current ? (late ? "bg-amber-500 text-white" : "bg-indigo-600 text-white") : "bg-slate-100 text-slate-400"}`}>
              {done ? <CheckIcon className="h-4 w-4" /> : i + 1}
            </span>
            <span className={`text-xs font-medium sm:text-sm ${done || current ? "text-ink" : "text-muted"}`}>{late ? "Needs your changes" : label}</span>
            {i < steps.length - 1 && <span className={`hidden h-0.5 flex-1 rounded sm:block ${done ? "bg-emerald-400" : "bg-slate-200"}`} />}
          </li>
        );
      })}
    </ol>
  );
}

// A simple barcode drawn from the card number (the same number always gives the same bars)
function Barcode({ value }: { value: string }) {
  const bars: number[] = [];
  for (const ch of value.padEnd(14, "0")) {
    const c = ch.charCodeAt(0);
    bars.push(1 + (c % 3), 1 + ((c >> 2) % 2), 1 + ((c >> 1) % 3));
  }
  let x = 0;
  return (
    <svg viewBox={`0 0 ${bars.reduce((a, b) => a + b, 0) * 1.6} 30`} className="h-8 w-full" aria-label={`Barcode ${value}`} role="img" preserveAspectRatio="none">
      {bars.map((w, i) => {
        const r = <rect key={i} x={x} y={0} width={i % 2 === 0 ? w : 0} height={30} fill="#0f1b33" />;
        x += w * 1.6;
        return r;
      })}
    </svg>
  );
}

// The digital student ID card. preview = while the student fills in the form.
export function DigitalCard({ name, studentNumber, course, photoUrl, cardNumber, expires, preview }: {
  name: string; studentNumber: string; course: string; photoUrl: string | null; cardNumber?: string; expires?: string; preview?: boolean;
}) {
  return (
    <div className="relative mx-auto aspect-[1.586] w-full max-w-sm overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f1b33] via-[#1f3176] to-[#2f4cdd] p-4 text-white shadow-xl shadow-indigo-200 print:shadow-none">
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
      <div className="relative flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-200">Northbridge University</p>
        <p className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold">{preview ? "PREVIEW" : "Student"}</p>
      </div>
      <div className="relative mt-3 flex gap-3">
        <div className="h-24 w-20 shrink-0 overflow-hidden rounded-lg bg-white/15 ring-2 ring-white/30">
          {photoUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={photoUrl} alt={`Photo of ${name}`} className="h-full w-full object-cover" />
            : <span className="flex h-full items-center justify-center px-1 text-center text-[10px] text-indigo-100">Your photo</span>}
        </div>
        <div className="min-w-0 text-xs">
          <p className="truncate text-base font-bold leading-tight">{name || "Your name"}</p>
          <p className="mt-1 text-indigo-100">Student no. <span className="font-mono font-semibold text-white">{studentNumber || "—"}</span></p>
          <p className="mt-0.5 line-clamp-2 text-indigo-100">{course || "Your course"}</p>
          {expires && <p className="mt-0.5 text-indigo-100">Expires <span className="font-semibold text-white">{new Date(expires).toLocaleDateString("en-AU", { month: "short", year: "numeric" })}</span></p>}
        </div>
      </div>
      <div className="absolute inset-x-4 bottom-3 rounded-md bg-white/95 px-2 py-1">
        <Barcode value={cardNumber ?? studentNumber ?? "preview"} />
        {cardNumber && <p className="text-center font-mono text-[9px] text-slate-700">{cardNumber}</p>}
      </div>
    </div>
  );
}

// Expected end of a course: Bachelor 3 years, Master 2, Diploma 1 (twice as long part-time).
// A February start finishes in November; a July start finishes in June.
export function completion(course: string, intake: string, load: string) {
  const years = (course.startsWith("Bachelor") ? 3 : course.startsWith("Master") ? 2 : 1) * (load === "Part-time" ? 2 : 1);
  const [month, y] = intake.split(" ");
  const start = Number(y);
  return month === "July" ? `June ${start + years}` : `November ${start + years - 1}`;
}

const fmt = (d?: string | boolean) => (typeof d === "string" && d ? new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" }) : "");

export function Outcome({ type, details, outcome, photoUrl, name, status = "completed", note = null, reference = "", updated = "" }: {
  type: string; details: Values; outcome: Record<string, string | boolean>; photoUrl: string | null; name: string;
  status?: string; note?: string | null; reference?: string; updated?: string;
}) {
  const d = (k: string) => String(details[k] ?? "");
  const o = (k: string) => (typeof outcome[k] === "string" ? (outcome[k] as string) : "");
  const pickup = o("pickup");

  return (
    <div className="space-y-4">
      {type === "id_card" && (
        <DigitalCard name={d("full_name")} studentNumber={d("student_number")} course={d("course")} photoUrl={photoUrl}
          cardNumber={o("card_number")} expires={o("expires")} />
      )}

      {type === "enrolment_letter" && (
        <article className="rounded-2xl border border-slate-200 bg-white p-6 text-sm leading-relaxed text-ink shadow-sm print:border-0 print:shadow-none">
          <div className="flex items-start justify-between border-b pb-3">
            <div><p className="font-bold text-indigo-800">Northbridge University</p><p className="text-xs text-muted">Student Centre · studentcentre@northbridge.example</p></div>
            <p className="text-right text-xs text-muted">Ref {o("reference")}<br />{fmt(o("issued"))}</p>
          </div>
          <p className="mt-4">{d("addressed_to") || "To whom it may concern"},</p>
          <p className="mt-3"><strong>Confirmation of enrolment</strong></p>
          <p className="mt-2">This letter confirms that <strong>{name}</strong> (student number {d("student_number")}) is currently enrolled{d("load") ? ` ${d("load").toLowerCase()}` : ""} at Northbridge University in the <strong>{d("course")}</strong>.</p>
          {d("intake") && (
            <p className="mt-2">The course started in <strong>{d("intake")}</strong>, and the expected completion date is <strong>{completion(d("course"), d("intake"), d("load"))}</strong>.</p>
          )}
          {d("include").includes("fees") && <p className="mt-2">The student&apos;s tuition fees and payments for this year are listed in their statement of account, available from the Student Centre on request.</p>}
          <p className="mt-2">This letter was requested for: {d("purpose").toLowerCase()}.</p>
          <p className="mt-4">Yours sincerely,<br /><strong>{o("issued_by") || "Student Centre"}</strong><br />Student Centre, Northbridge University</p>
          <p className="mt-4 border-t pt-2 text-xs text-muted">Sample letter made by a student demo project. Northbridge University is not a real organisation.</p>
        </article>
      )}

      {type === "holiday_letter" && (
        <article className="rounded-2xl border border-slate-200 bg-white p-6 text-sm leading-relaxed text-ink shadow-sm print:border-0 print:shadow-none">
          <div className="flex items-start justify-between border-b pb-3">
            <div><p className="font-bold text-indigo-800">Northbridge University</p><p className="text-xs text-muted">Student Centre · studentcentre@northbridge.example</p></div>
            <p className="text-right text-xs text-muted">Ref {o("reference")}<br />{fmt(o("issued"))}</p>
          </div>
          <p className="mt-4">{d("addressed_to") || "To whom it may concern"},</p>
          <p className="mt-3"><strong>Confirmation of university break dates</strong></p>
          <p className="mt-2">This letter confirms that <strong>{name}</strong> (student number {d("student_number")}) is enrolled{d("load") ? ` ${d("load").toLowerCase()}` : ""} at Northbridge University in the <strong>{d("course")}</strong>.</p>
          <p className="mt-2">The university&apos;s official {o("break_name")} runs from <strong>{fmt(o("break_from"))}</strong> to <strong>{fmt(o("break_to"))}</strong>. There are no classes during this time, and classes start again on <strong>{fmt(o("resume"))}</strong>.</p>
          {d("leaving") && d("returning") && (
            <p className="mt-2">{name.split(" ")[0] || "The student"} plans to be away from <strong>{fmt(d("leaving"))}</strong> to <strong>{fmt(d("returning"))}</strong>, which is within the official break. We expect them to continue their studies when classes start again.</p>
          )}
          <p className="mt-2">This letter was requested for: {d("purpose").toLowerCase()}.</p>
          <p className="mt-4">Yours sincerely,<br /><strong>{o("issued_by") || "Student Centre"}</strong><br />Student Centre, Northbridge University</p>
          <p className="mt-4 border-t pt-2 text-xs text-muted">Sample letter made by a student demo project. Northbridge University is not a real organisation.</p>
        </article>
      )}

      {type === "completion_letter" && (
        <article className="rounded-2xl border border-slate-200 bg-white p-6 text-sm leading-relaxed text-ink shadow-sm print:border-0 print:shadow-none">
          <div className="flex items-start justify-between border-b pb-3">
            <div><p className="font-bold text-indigo-800">Northbridge University</p><p className="text-xs text-muted">Student Centre · studentcentre@northbridge.example</p></div>
            <p className="text-right text-xs text-muted">Ref {o("reference")}<br />{fmt(o("issued"))}</p>
          </div>
          <p className="mt-4">{d("addressed_to") || "To whom it may concern"},</p>
          <p className="mt-3"><strong>Confirmation of course completion</strong></p>
          <p className="mt-2">This letter confirms that <strong>{name}</strong> (student number {d("student_number")}) has completed all the requirements of the <strong>{d("course")}</strong> at Northbridge University.</p>
          <p className="mt-2">They started the course in <strong>{d("intake")}</strong>, studied {d("load").toLowerCase() || "full-time"}, and completed it in <strong>{o("completed") ? new Date(o("completed")).toLocaleDateString("en-AU", { month: "long", year: "numeric" }) : ""}</strong>. The award will be conferred at the next graduation ceremony.</p>
          <p className="mt-2">This letter was requested for: {d("purpose").toLowerCase()}.</p>
          <p className="mt-4">Yours sincerely,<br /><strong>{o("issued_by") || "Student Centre"}</strong><br />Student Centre, Northbridge University</p>
          <p className="mt-4 border-t pt-2 text-xs text-muted">Sample letter made by a student demo project. Northbridge University is not a real organisation.</p>
        </article>
      )}

      {type === "special_consideration" && (o("decision") || status === "rejected") && (() => {
        const approved = status !== "rejected";
        return (
          <article className="rounded-2xl border border-slate-200 bg-white p-6 text-sm leading-relaxed text-ink shadow-sm print:border-0 print:shadow-none">
            <div className="flex items-start justify-between border-b pb-3">
              <div><p className="font-bold text-indigo-800">Northbridge University</p><p className="text-xs text-muted">Academic Services · academicservices@northbridge.example</p></div>
              <p className="text-right text-xs text-muted">Ref {reference}<br />{fmt(o("decided_on")) || fmt(updated)}</p>
            </div>
            <p className="mt-4">Dear {name.split(" ")[0] || "student"},</p>
            <p className="mt-3"><strong>Special consideration: {approved ? "approved" : "not approved"}</strong></p>
            <table className="mt-3 w-full text-left text-sm">
              <tbody>
                <tr><td className="w-44 py-0.5 text-muted">Unit</td><td className="font-medium">{d("unit")}</td></tr>
                <tr><td className="py-0.5 text-muted">Assessment</td><td className="font-medium">{d("assessment")}{d("due_date") ? `, due ${fmt(d("due_date"))}` : ""}</td></tr>
                <tr><td className="py-0.5 text-muted">You asked for</td><td className="font-medium">{d("asking")}</td></tr>
                <tr><td className="py-0.5 text-muted">Decision</td><td className={`font-bold ${approved ? "text-emerald-700" : "text-rose-700"}`}>{approved ? "Approved" : "Not approved"}</td></tr>
              </tbody>
            </table>
            {approved ? (
              <p className="mt-3">We have considered your circumstances and <strong>approved your request</strong>. {note ? <>Here is what happens next: <strong>{note}</strong></> : "Your unit coordinator will confirm the new arrangements with you."}</p>
            ) : (
              <>
                <p className="mt-3">We have carefully considered your request, but we are not able to approve it.{note ? <> The reason is: <strong>{note}</strong></> : ""}</p>
                <p className="mt-2">If you disagree, you can ask for a review within 10 working days. Reply in Help &amp; chat, or talk to a person from My appointments.</p>
              </>
            )}
            <p className="mt-3">We know this can be a hard time. Student Wellbeing is free and confidential if you would like support.</p>
            <p className="mt-4">Yours sincerely,<br /><strong>{o("decided_by") || "Academic Services"}</strong><br />Academic Services, Northbridge University</p>
            <p className="mt-4 border-t pt-2 text-xs text-muted">Sample decision made by a student demo project. Northbridge University is not a real organisation.</p>
          </article>
        );
      })()}

      {type === "transcript" && (() => {
        const t = d("course") && d("intake") ? buildTranscript(d("course"), d("intake"), d("load"), d("student_number")) : null;
        const official = d("kind").startsWith("Official");
        if (!t) {
          return (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm shadow-sm">
              <p className="font-semibold">{d("kind")} transcript · Ref {o("reference")}</p>
              <p className="mt-1 text-muted">Issued {fmt(o("issued"))}</p>
              {o("sent") && <p className="mt-2">{o("sent")}.</p>}
            </div>
          );
        }
        return (
          <article className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 text-sm text-ink shadow-sm print:border-0 print:shadow-none">
            {!official && <p aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 select-none text-7xl font-black tracking-widest text-slate-100">UNOFFICIAL</p>}
            <div className="relative">
              <div className="flex items-start justify-between gap-4 border-b pb-3">
                <div>
                  <p className="text-lg font-bold text-indigo-800">Northbridge University</p>
                  <p className="font-semibold">{official ? "Official academic transcript" : "Unofficial academic transcript"}</p>
                </div>
                <div className="text-right text-xs text-muted">
                  <p>Ref {o("reference")}</p><p>Issued {fmt(o("issued"))}</p>
                  {official && (
                    <span className="mt-2 inline-flex h-16 w-16 items-center justify-center rounded-full border-2 border-indigo-700 text-center text-[8px] font-bold uppercase leading-tight text-indigo-800">Northbridge<br />University<br />seal</span>
                  )}
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
                <div><dt className="text-xs text-muted">Student</dt><dd className="font-semibold">{name}</dd></div>
                <div><dt className="text-xs text-muted">Student number</dt><dd className="font-mono font-semibold">{d("student_number")}</dd></div>
                <div className="col-span-2"><dt className="text-xs text-muted">Course</dt><dd className="font-semibold">{d("course")} ({d("load") || "Full-time"})</dd></div>
                <div><dt className="text-xs text-muted">Started</dt><dd>{d("intake")}</dd></div>
                <div><dt className="text-xs text-muted">Status</dt><dd>{t.status}</dd></div>
                <div><dt className="text-xs text-muted">Expected completion</dt><dd>{completion(d("course"), d("intake"), d("load"))}</dd></div>
              </dl>
              {t.terms.map((term) => (
                <section key={term.label} className="mt-4 break-inside-avoid">
                  <h4 className="mb-1 font-semibold">{term.label}{term.current && <span className="ml-2 text-xs font-normal text-muted">(in progress)</span>}</h4>
                  <table className="w-full table-fixed text-left text-[13px]">
                    <thead className="border-b text-xs text-muted"><tr><th className="w-20 py-1 pr-2 font-medium">Unit</th><th className="py-1 pr-2 font-medium">Name</th><th className="w-16 py-1 pr-2 text-right font-medium">Credit</th><th className="w-16 py-1 pr-2 text-right font-medium">Mark</th><th className="w-20 py-1 text-right font-medium">Grade</th></tr></thead>
                    <tbody>
                      {term.rows.map((u) => (
                        <tr key={u.code} className="border-b border-slate-100">
                          <td className="py-1 pr-2 font-mono">{u.code}</td><td className="py-1 pr-2">{u.name}</td>
                          <td className="py-1 pr-2 text-right">{u.points}</td><td className="py-1 pr-2 text-right">{u.mark ?? "—"}</td>
                          <td className={`py-1 text-right font-semibold ${u.grade === "Enrolled" ? "font-normal text-muted" : ""}`}>{u.grade}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              ))}
              <div className="mt-4 grid grid-cols-3 gap-3 rounded-xl bg-slate-50 p-3 text-center">
                <div><p className="text-xs text-muted">Credit points</p><p className="font-semibold">{t.creditDone} of {t.creditTotal}</p></div>
                <div><p className="text-xs text-muted">GPA (out of 7)</p><p className="font-semibold">{t.gpa ?? "—"}</p></div>
                <div><p className="text-xs text-muted">Average mark (WAM)</p><p className="font-semibold">{t.wam ?? "—"}</p></div>
              </div>
              <p className="mt-3 text-xs text-muted">Grades: HD High Distinction (85–100), D Distinction (75–84), C Credit (65–74), P Pass (50–64), N Fail (below 50).</p>
              {o("sent") && <p className="mt-1 text-xs text-muted">{o("sent")}.</p>}
              <p className="mt-3 border-t pt-2 text-xs text-muted">Sample transcript made by a student demo project. Northbridge University is not a real organisation and these results are not real.</p>
            </div>
          </article>
        );
      })()}

      {type === "credit_transfer" && Array.isArray((outcome as unknown as { units?: unknown }).units) && (() => {
        const res = outcome as unknown as { units: { name: string; code: string; grade: string; year: number | null; decision: string; reason: string; nb_code: string | null; nb_name: string | null }[];
          granted_units: number; review_units: number; granted_points: number; total_points: number; assessor?: string; assessor_date?: string; assessed?: string };
        const confirmed = !!res.assessor;
        const units = res.granted_units + (confirmed ? res.review_units : 0);
        const finish = d("course") && d("intake") ? finishWith(d("course"), d("intake"), d("load"), units) : null;
        return (
          <article className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-ink shadow-sm print:border-0 print:shadow-none">
            <div className="flex items-start justify-between gap-4 border-b pb-3">
              <div><p className="text-lg font-bold text-indigo-800">Northbridge University</p><p className="font-semibold">Credit for previous study: decision</p></div>
              <p className="text-right text-xs text-muted">Assessed {fmt(String(res.assessed ?? ""))}<br />by the AI Credit Assessor{confirmed ? <><br />Confirmed by {res.assessor}</> : null}</p>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
              <div><dt className="text-xs text-muted">Student</dt><dd className="font-semibold">{name}</dd></div>
              <div><dt className="text-xs text-muted">Student number</dt><dd className="font-mono font-semibold">{d("student_number")}</dd></div>
              <div className="col-span-2"><dt className="text-xs text-muted">Course</dt><dd className="font-semibold">{d("course")} ({d("load")}, from {d("intake")})</dd></div>
              <div className="col-span-2"><dt className="text-xs text-muted">Previous study</dt><dd>{d("institution")}{d("qualification") ? `, ${d("qualification")}` : ""}</dd></div>
              <div><dt className="text-xs text-muted">Credit approved</dt><dd className="font-semibold">{units * 10} of {res.total_points} credit points</dd></div>
              <div><dt className="text-xs text-muted">Expected finish</dt><dd className="font-semibold">{finish ?? "—"}</dd></div>
            </dl>
            <table className="mt-4 w-full table-fixed text-left text-[13px]">
              <thead className="border-b text-xs text-muted"><tr><th className="py-1 pr-2 font-medium">Your unit</th><th className="w-48 py-1 pr-2 font-medium">Northbridge unit</th><th className="w-36 py-1 font-medium">Decision</th></tr></thead>
              <tbody>
                {res.units.map((u, i) => {
                  const label = u.decision === "granted" ? "Credit approved" : u.decision === "review" ? (confirmed ? "Approved by assessor" : "Assessor checking") : "No credit";
                  const tone = u.decision === "granted" || (u.decision === "review" && confirmed) ? "text-emerald-700" : u.decision === "review" ? "text-amber-700" : "text-muted";
                  return (
                    <tr key={i} className="border-b border-slate-100 align-top">
                      <td className="py-1.5 pr-2"><span className="font-medium">{u.name}</span><span className="block text-xs text-muted">{[u.code, u.grade, u.year].filter(Boolean).join(" · ")}{u.decision === "none" ? ` · ${u.reason}` : ""}</span></td>
                      <td className="py-1.5 pr-2">{u.nb_code ? <><span className="font-mono text-xs">{u.nb_code}</span> {u.nb_name}</> : "—"}</td>
                      <td className={`py-1.5 font-semibold ${tone}`}>{label}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-muted">Rules: passed units from the last 10 years that match a unit in the course, up to half of the course. Credited units do not need to be studied or paid for.</p>
            <p className="mt-3 border-t pt-2 text-xs text-muted">Sample decision made by a student demo project. Northbridge University is not a real organisation.</p>
          </article>
        );
      })()}

      {type === "parking_permit" && (
        <div className="mx-auto max-w-sm overflow-hidden rounded-2xl border-2 border-amber-400 bg-amber-50 text-ink shadow-sm">
          <div className="bg-amber-400 px-4 py-2 text-sm font-bold uppercase tracking-wider text-amber-950">Northbridge parking permit</div>
          <div className="space-y-1 p-4 text-sm">
            <p className="font-mono text-2xl font-bold tracking-widest">{d("rego")}</p>
            <p>{d("rego_state")} · {d("car")}</p>
            <p>{d("permit").replace(/ \(.*\)$/, "")}</p>
            <p>Valid <strong>{fmt(o("valid_from"))}</strong>{o("valid_to") !== o("valid_from") ? <> to <strong>{fmt(o("valid_to"))}</strong></> : " (one day)"}</p>
            <p className="pt-1 font-mono text-xs text-muted">Permit {o("permit_number")}</p>
            <p className="pt-2 text-xs text-muted">Your number plate is your permit: no sticker needed.</p>
          </div>
        </div>
      )}

      {type === "delivery_address" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm"><p className="text-xs font-semibold uppercase text-muted">Old address</p><p className="mt-1 line-through decoration-slate-400">{o("old_address")}</p></div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm"><p className="text-xs font-semibold uppercase text-emerald-700">New address</p><p className="mt-1 font-semibold">{o("new_address")}</p></div>
        </div>
      )}

      {pickup && (
        <p className="rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <strong>{outcome.collected_at ? "Collected." : "Ready to collect."}</strong> {outcome.collected_at ? `Collected on ${fmt(o("collected_at"))}.` : pickup}
        </p>
      )}
    </div>
  );
}
