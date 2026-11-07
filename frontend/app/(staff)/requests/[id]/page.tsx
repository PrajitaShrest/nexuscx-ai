import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import NoAccess from "@/components/NoAccess";
import LiveRefresh from "@/components/LiveRefresh";
import FormIcon from "@/components/requests/FormIcon";
import { Outcome, RequestPill } from "@/components/requests/Outcome";
import { can, getMe } from "@/lib/data/me";
import { getPack } from "@/lib/industry";
import { getFormFields, getRequest, signRequestPhoto } from "@/lib/data/requests";
import { needsPickup } from "@/lib/forms";
import { dayTime } from "@/lib/format";
import StaffActions from "../StaffActions";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Request" };

const LABELS: Record<string, string> = {
  full_name: "Full name", student_number: "Student number", date_of_birth: "Date of birth", course: "Course", reason: "Reason",
  delivery: "Delivery", institution: "Studied at", qualification: "Qualification", intake: "Started", load: "Study load", purpose: "Purpose", addressed_to: "Addressed to", include: "Include", kind: "Transcript", copies: "Copies",
  postal_address: "Postal address", rego: "Registration", rego_state: "State", car: "Car", permit: "Permit", start_date: "Start date",
  phone: "Mobile", order: "Order", recipient: "Recipient", line1: "Street", line2: "Unit / level", suburb: "Suburb", state: "State",
  postcode: "Postcode", instructions: "Instructions",
};

export default async function StaffRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await getMe();
  if (!can(me, "view_cases")) return <NoAccess me={me} page="Requests" needs="view_cases" />;
  const { id } = await params;
  const [r, pack] = await Promise.all([getRequest(id), getPack()]);
  if (!r) notFound();
  const photoUrl = await signRequestPhoto(r.photo_path, r.type_key);
  const credit = r.type_key === "credit_transfer";
  const pickup = needsPickup(r.details);
  // Labels and order come from the form itself, so every form (old or new) reads the same way
  const fields = await getFormFields(r.type_key);
  const short = (label: string) => label.replace(/\s*\((optional|as it should appear[^)]*)\).*$/i, "").replace(/,? for example.*$/i, "").replace(/\?$/, "");
  const nice = (k: string) => k.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
  const known = fields.filter((f) => f.type !== "checkbox" && f.type !== "photo").map((f) => f.name);
  const extra = Object.keys(r.details).filter((k) => !known.includes(k) && k !== "confirm");
  const fmtValue = (k: string, v: unknown) => {
    const f = fields.find((x) => x.name === k);
    if ((f?.type === "date" || /date|_on$/.test(k)) && typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v))
      return new Date(`${v}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
    return String(v);
  };
  const rows = [...known, ...extra]
    .map((k) => [k, r.details[k]] as const)
    .filter(([, v]) => v !== undefined && v !== "" && v !== false)
    .map(([k, v]) => ({ k, label: short(fields.find((f) => f.name === k)?.label ?? LABELS[k] ?? nice(k)), value: fmtValue(k, v) }));

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 text-gray-900 md:flex-row">
      <Sidebar me={me} active="/requests" />
      <main className="min-w-0 flex-1 p-6">
        <Link href="/requests" className="text-sm font-medium text-indigo-700 hover:underline">← Requests</Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <FormIcon icon={r.request_types?.icon ?? ""} />
            <div>
              <h1 className="flex flex-wrap items-center gap-3 text-xl font-semibold">{r.request_types?.title} · {r.request_number} <RequestPill status={r.status} staff /></h1>
              <p className="text-sm text-gray-500">
                From {r.customer?.user?.name} · sent {dayTime(r.created_at)} · {r.request_types?.team_name} team
                {r.due_at && ["submitted", "in_review"].includes(r.status) && <> · target {dayTime(r.due_at)}</>}
              </p>
            </div>
          </div>
          <LiveRefresh name={`staff-request-${r.request_id}`} watch={[{ table: "service_requests", event: "UPDATE", filter: `request_id=eq.${r.request_id}` }]} />
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <section className="rounded-lg border bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold">Details sent</h2>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">✓ All fields checked by the form</span>
              </div>
              <div className="flex flex-wrap gap-5">
                {photoUrl && credit && <a href={photoUrl} target="_blank" rel="noreferrer" className="font-semibold text-indigo-700 hover:underline">Open the student&apos;s transcript ↗</a>}
                {photoUrl && !credit && (
                  <figure className="shrink-0">
                    <a href={photoUrl} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photoUrl} alt={`Photo sent by ${r.customer?.user?.name}`} className="h-48 w-40 rounded-lg border object-cover" />
                    </a>
                    <figcaption className="mt-1 text-xs text-gray-500">Click to open full size</figcaption>
                  </figure>
                )}
                <dl className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-x-4 gap-y-2 text-sm">
                  {rows.map((row) => (<Fragment key={row.k}><dt className="text-gray-500">{row.label}</dt><dd className="whitespace-pre-line break-words font-medium">{row.value}</dd></Fragment>))}
                  <dt className="text-gray-500">Email</dt><dd className="break-words">{r.customer?.user?.email}</dd>
                </dl>
              </div>
              {r.request_types?.fee_note && <p className="mt-4 rounded bg-gray-50 px-3 py-2 text-xs text-gray-600">{r.request_types.fee_note}</p>}
            </section>

            {(r.status === "ready" || r.status === "completed" || credit) && (
              <section className="rounded-lg border bg-white p-5">
                <h2 className="mb-3 font-semibold">{credit ? "The AI Credit Assessor’s decision" : `What ${r.customer?.user?.name?.split(" ")[0]} received`}</h2>
                <Outcome type={r.type_key} details={r.details} outcome={r.outcome} photoUrl={photoUrl} name={r.customer?.user?.name ?? ""}
                  status={r.status} note={r.staff_note} reference={r.request_number} updated={r.updated_at} />
              </section>
            )}
            {r.staff_note && ["needs_info", "rejected"].includes(r.status) && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><strong>Note sent to the {pack.person.toLowerCase()}:</strong> {r.staff_note}</p>
            )}

            <section className="rounded-lg border bg-white p-5">
              <h2 className="mb-3 font-semibold">History</h2>
              <ol className="space-y-3 text-sm">
                {r.service_request_events.map((e) => (
                  <li key={e.event_id} className="flex gap-3">
                    <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${e.actor_type === "staff" ? "bg-indigo-500" : "bg-gray-300"}`} />
                    <span><span className="font-medium">{e.note}</span><span className="block text-xs text-gray-500">{e.actor_name ?? "System"} · {dayTime(e.created_at)}</span></span>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <aside className="space-y-5">
            <section className="rounded-lg border bg-white p-5">
              <h2 className="mb-3 font-semibold">Decision</h2>
              <StaffActions id={r.request_id} type={r.type_key} status={r.status} pickup={pickup} hasPhoto={!!r.photo_path} />
            </section>
            <section className="rounded-lg border bg-white p-5 text-sm">
              <h2 className="mb-2 font-semibold">{pack.person}</h2>
              <p className="font-medium">{r.customer?.user?.name}</p>
              <p className="text-gray-500">{r.customer?.user?.email}</p>
              {r.customer?.student_number && <p className="text-gray-500">Student number {r.customer.student_number}</p>}
              {r.assignee && <p className="mt-2 text-gray-500">Handled by {r.assignee.name}</p>}
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
