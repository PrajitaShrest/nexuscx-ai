import { NextResponse } from "next/server";
import { getMe, can } from "@/lib/data/me";
import { getCareReport } from "@/lib/data/ops";
import { FLAG_LABEL } from "@/lib/care";

// CSV of every sensitive case in the duty-of-care report
export async function GET(request: Request) {
  const me = await getMe();
  if (!can(me, "view_analytics")) return new NextResponse("Not allowed", { status: 403 });
  const days = Number(new URL(request.url).searchParams.get("days")) || 30;
  const { data, error } = await getCareReport(days);
  if (!data) return new NextResponse(error ?? "Could not build the report", { status: 500 });
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [["Case", "Reason", "Priority", "Status", "Created", "Went to a person", "Picked up after (min)", "Target (min)"].map(esc).join(",")];
  for (const c of data.list) {
    rows.push([c.case_number, FLAG_LABEL[c.flag] ?? c.flag, c.priority, c.status, c.created_at, c.to_person ? "Yes" : "No", c.pickup_min ?? "", c.target_min ?? ""].map(esc).join(","));
  }
  return new NextResponse(rows.join("\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="duty-of-care-${days}d.csv"` },
  });
}
