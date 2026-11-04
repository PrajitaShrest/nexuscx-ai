import Link from "next/link";
import { notFound } from "next/navigation";
import { getRequest, getRequestForms, signRequestPhoto } from "@/lib/data/requests";
import { getMe } from "@/lib/data/me";
import { Panel } from "@/components/ShopUI";
import LiveRefresh from "@/components/LiveRefresh";
import FormIcon from "@/components/requests/FormIcon";
import RequestForm from "@/components/requests/RequestForm";
import CancelRequest from "@/components/requests/CancelRequest";
import DownloadPdf from "@/components/requests/DownloadPdf";
import { Outcome, RequestPill, RequestSteps } from "@/components/requests/Outcome";
import { hoursText, needsPickup, optionsFor } from "@/lib/forms";
import { day, dayTime } from "@/lib/format";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Request" };

// Results that can be saved as a PDF, and the start of their file name
const DOCS: Record<string, string> = { id_card: "Student ID card", enrolment_letter: "Enrolment letter", transcript: "Transcript", parking_permit: "Parking permit" };

export default async function MyRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [r, me, { types, prefill }] = await Promise.all([getRequest(id), getMe(), getRequestForms()]);
  if (!r) notFound();
  const type = types.find((t) => t.type_key === r.type_key);
  const photoUrl = await signRequestPhoto(r.photo_path);
  const pickup = needsPickup(r.details);
  const done = r.status === "ready" || r.status === "completed";
  const fields = (type?.fields ?? []).filter((f) => f.type !== "photo" && f.type !== "checkbox" && r.details[f.name] !== undefined && r.details[f.name] !== "");

  return (
    <>
      <div>
        <Link href="/account/requests" className="text-sm font-medium text-indigo-700 hover:underline">← Requests &amp; forms</Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <FormIcon icon={r.request_types?.icon ?? ""} />
            <div>
              <h1 className="flex flex-wrap items-center gap-3 text-2xl font-bold sm:text-3xl">{r.request_types?.title} <RequestPill status={r.status} /></h1>
              <p className="text-muted">{r.request_number} · sent {day(r.created_at)} · {r.request_types?.team_name} team</p>
            </div>
          </div>
          <LiveRefresh name={`request-${r.request_id}`} watch={[{ table: "service_requests", event: "UPDATE", filter: `request_id=eq.${r.request_id}` }]} />
        </div>
      </div>

      <Panel><RequestSteps status={r.status} pickup={pickup} />
        {(r.status === "submitted" || r.status === "in_review") && (
          <p className="mt-4 text-sm text-muted">The {r.request_types?.team_name} team usually finishes these {hoursText(r.request_types?.sla_hours ?? 24)}. We&apos;ll notify you.</p>
        )}
      </Panel>

      {r.status === "needs_info" && type && (
        <>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-950">
            <p className="font-semibold">The {r.request_types?.team_name} team asked for a change</p>
            <p className="mt-1">&ldquo;{r.staff_note}&rdquo;</p>
          </div>
          <RequestForm type={type} prefill={prefill} mode="fix" requestId={r.request_id} saved={r.details} savedPhotoUrl={photoUrl} />
        </>
      )}

      {r.status === "rejected" && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-rose-950">
          <p className="font-semibold">This request could not be completed</p>
          {r.staff_note && <p className="mt-1">&ldquo;{r.staff_note}&rdquo;</p>}
          <p className="mt-2 text-sm">You can send a new request, or ask in Help &amp; chat.</p>
        </div>
      )}

      {done && (
        <Panel title={r.type_key === "id_card" ? "Your digital student card" : "Your result"}
          action={DOCS[r.type_key] ? <DownloadPdf fileName={`${DOCS[r.type_key]} ${String(r.outcome.reference ?? r.outcome.card_number ?? r.outcome.permit_number ?? r.request_number)}`} /> : undefined}>
          {String(r.details.delivery ?? "").startsWith("Email") && (
            <p className="mb-3 rounded-xl bg-indigo-50 px-4 py-2.5 text-sm text-indigo-900 print:hidden">You asked for this by email. You can also download it here at any time with <strong>Download PDF</strong>.</p>
          )}
          <div className="print-area"><Outcome type={r.type_key} details={r.details} outcome={r.outcome} photoUrl={photoUrl} name={me.name} /></div>
          {r.staff_note && <p className="mt-3 text-sm text-muted">Note from {r.assignee?.name ?? "the team"}: {r.staff_note}</p>}
        </Panel>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="What you sent">
          <dl className="space-y-2 text-sm">
            {fields.map((f) => (
              <div key={f.name} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3">
                <dt className="text-muted">{f.label.replace(/ \(optional\)$/, "")}</dt>
                <dd className="break-words font-medium">{f.options_from ? optionsFor(f, prefill).find((o) => o.value === r.details[f.name])?.label ?? String(r.details[f.name]) : String(r.details[f.name])}</dd>
              </div>
            ))}
            {photoUrl && r.type_key !== "id_card" && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="Your photo" className="h-28 w-24 rounded-lg object-cover" />
            )}
          </dl>
          {(r.status === "submitted" || r.status === "needs_info") && <div className="mt-4"><CancelRequest id={r.request_id} /></div>}
        </Panel>
        <Panel title="History">
          <ol className="space-y-3 text-sm">
            {r.service_request_events.map((e) => (
              <li key={e.event_id} className="flex gap-3">
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${e.actor_type === "staff" ? "bg-indigo-500" : "bg-slate-300"}`} />
                <span><span className="font-medium">{e.note}</span><span className="block text-xs text-muted">{e.actor_name ?? "System"} · {dayTime(e.created_at)}</span></span>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </>
  );
}
