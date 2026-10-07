import { connection } from "next/server";
import { pool } from "@/lib/db";

// GET /api/cases
// Returns every case that is not closed, newest first,
// with the customer's name and the first customer message as the subject.
export async function GET() {
  // Mark this route as dynamic so it always reads fresh data from the database
  await connection();
  try {
    const { rows } = await pool.query(`
      SELECT c.case_id, u.name AS customer, c.intent, c.priority,
             c.risk, c.confidence, c.status, c.created_at,
             (SELECT m.content
                FROM conversations cv
                JOIN messages m ON m.conversation_id = cv.conversation_id
               WHERE cv.case_id = c.case_id AND m.sender_type = 'customer'
               ORDER BY m.sent_at ASC
               LIMIT 1) AS subject
      FROM cases c
      JOIN customers cu ON cu.customer_id = c.customer_id
      JOIN users u ON u.user_id = cu.user_id
      WHERE c.status <> 'closed'
      ORDER BY c.created_at DESC`);
    return Response.json(rows);
  } catch (err) {
    console.error("GET /api/cases failed:", err);
    return Response.json({ error: "Could not load cases" }, { status: 500 });
  }
}
