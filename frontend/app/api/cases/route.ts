import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/data/errors";

// GET /api/cases - the case queue as JSON, for API testing.
// 401 if not signed in. Signed in, Row Level Security decides which rows come back:
// customers get their own cases, staff get all cases.
export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) {
    return Response.json({ error: "Please sign in." }, { status: 401 });
  }
  const { data, error } = await supabase
    .from("v_case_queue")
    .select("case_number, customer_name, subject, intent, priority, status, assigned_to")
    .order("created_at", { ascending: false });
  if (error) return Response.json({ error: friendlyError(error, "GET /api/cases") }, { status: 500 });
  return Response.json(data);
}
