import { connection } from "next/server";
import { pool } from "@/lib/db";

// GET /api/cases
// Returns every case that is not closed, newest first, from the v_case_queue view
// (customer name, CX number, subject, assigned agent and SLA time left).
export async function GET() {
  // Mark this route as dynamic so it always reads fresh data from the database
  await connection();
  try {
    const { rows } = await pool.query(`
      SELECT case_id, case_number, customer_name AS customer, subject,
             intent, priority, sentiment, risk, confidence, status,
             assigned_to, sla_minutes_left, created_at
      FROM v_case_queue
      WHERE status <> 'closed'
      ORDER BY created_at DESC`);
    return Response.json(rows);
  } catch (err) {
    console.error("GET /api/cases failed:", err);
    return Response.json({ error: "Could not load cases" }, { status: 500 });
  }
}
