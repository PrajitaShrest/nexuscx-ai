import { Pool } from "pg";

// One shared connection pool to Supabase PostgreSQL.
// DATABASE_URL lives in .env.local (never committed to GitHub).
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
