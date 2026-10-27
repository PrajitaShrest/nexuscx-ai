import { z } from "zod";
import { ALL_KB_CATS } from "@/lib/packs";
import { normaliseMobile } from "@/lib/auth/phone";

// IDs use guid() (any 8-4-4-4-12 hex id), because some seed rows use fixed ids that are not strict v4 UUIDs.
// One place for form rules. Server actions use these before calling the database,
// and the database checks again (CHECK constraints and RPC checks), so nothing relies on the browser.

export type Invalid = { error: string; field?: string };

/** Runs a schema. Returns the clean data, or the first problem in plain English with the field name. */
export function check<T extends z.ZodType>(schema: T, input: unknown): { data: z.infer<T> } | Invalid {
  const r = schema.safeParse(input);
  if (r.success) return { data: r.data };
  const issue = r.error.issues[0];
  return { error: issue.message, field: issue.path[0] ? String(issue.path[0]) : undefined };
}

/** Turns FormData into a plain object (trimmed strings). */
export function formObject(f: FormData) {
  const o: Record<string, string> = {};
  f.forEach((v, k) => { if (typeof v === "string") o[k] = v.trim(); });
  return o;
}

const text = (min: number, max: number, short: string, long: string) => z.string().trim().min(min, short).max(max, long);
const id = (msg: string) => z.string().guid(msg);

export const STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"] as const;

export const addressSchema = z.object({
  address_id: z.string().optional().transform((v) => v || null),
  label: z.enum(["Home", "Work", "Other"]).catch("Home"),
  recipient: text(2, 80, "Please enter who will receive the delivery.", "Name can be up to 80 characters."),
  phone: z.string().optional().transform((v, ctx) => {
    if (!v) return "";
    const p = normaliseMobile(v);
    if (!p) { ctx.addIssue({ code: "custom", message: "Enter an Australian mobile, like 0412 345 678." }); return z.NEVER; }
    return p;
  }),
  line1: text(3, 120, "Please enter the street address.", "Street address can be up to 120 characters."),
  line2: z.string().max(120, "This line can be up to 120 characters.").optional().default(""),
  suburb: text(2, 60, "Please enter the suburb.", "Suburb can be up to 60 characters."),
  state: z.enum(STATES, { message: "Please choose a state." }),
  postcode: z.string().regex(/^\d{4}$/, "Postcode must be 4 digits."),
  is_default: z.string().optional().transform((v) => v === "on"),
  next: z.string().optional().default(""),
});

export const enquirySchema = z.object({
  message: text(5, 2000, "Please describe your issue in at least 5 characters.", "Please keep your message under 2000 characters."),
});

export const chatReplySchema = z.object({
  case_id: id("This chat could not be found."),
  message: text(2, 2000, "Please write a message first.", "Please keep your message under 2000 characters."),
});

export const staffReplySchema = z.object({
  case_id: id("This case could not be found."),
  message: text(2, 4000, "Write a message first.", "Replies can be up to 4000 characters."),
  then: z.enum(["", "waiting", "resolved"]).catch(""),
});

export const noteSchema = z.object({
  case_id: id("This case could not be found."),
  note: text(2, 2000, "Write the note first.", "Notes can be up to 2000 characters."),
});

export const ratingSchema = z.object({
  case_id: id("This chat could not be found."),
  rating: z.coerce.number().int().min(1, "Please choose 1 to 5 stars.").max(5, "Please choose 1 to 5 stars."),
  comment: z.string().max(500, "Comments can be up to 500 characters.").optional().default(""),
});

const jsonArray = <T extends z.ZodType>(item: T, empty: string, bad: string) =>
  z.string().transform((s, ctx) => {
    try { return JSON.parse(s || "[]"); } catch { ctx.addIssue({ code: "custom", message: bad }); return z.NEVER; }
  }).pipe(z.array(item, { message: bad }).min(1, empty));

export const checkoutSchema = z.object({
  address_id: id("Please choose a delivery address."),
  notes: z.string().max(300, "Delivery notes can be up to 300 characters.").optional().default(""),
  cart: jsonArray(
    z.object({ product_id: z.string().guid(), quantity: z.coerce.number().int().min(1).max(10, "You can buy up to 10 of each item.") }),
    "Your cart is empty.", "Your cart could not be read. Please try again."),
});

export const RETURN_REASONS = ["damaged", "wrong_item", "wrong_size", "not_as_described", "changed_mind", "faulty"] as const;

export const returnSchema = z.object({
  order_id: id("This order could not be found."),
  kind: z.enum(["return", "exchange"], { message: "Please choose return or exchange." }),
  reason: z.enum(RETURN_REASONS, { message: "Please choose a reason." }),
  details: z.string().max(1000, "Details can be up to 1000 characters.").optional().default(""),
  items: jsonArray(
    z.object({ order_item_id: z.string().guid(), quantity: z.coerce.number().int().min(1), exchange_for: z.string().trim().max(120).optional() }),
    "Please choose at least one item.", "Please choose the items again."),
  photos: z.string().optional().default("[]").transform((s, ctx) => {
    try { return JSON.parse(s || "[]"); } catch { ctx.addIssue({ code: "custom", message: "Please add the photos again." }); return z.NEVER; }
  }).pipe(z.array(z.string().max(200)).max(3, "You can add up to 3 photos.")),
}).refine((r) => r.kind === "return" || r.items.every((i) => i.exchange_for), {
  message: "Tell us what you'd like instead for each item (for example, size or colour).", path: ["items"],
});

export const knowledgeSchema = z.object({
  document_id: z.string().optional().transform((v) => v || null),
  title: text(5, 150, "Give the article a title (at least 5 characters).", "Titles can be up to 150 characters."),
  category: z.string().refine((c) => ALL_KB_CATS.includes(c), { message: "Please choose a category." }),
  content: text(30, 8000, "Write the answer (at least 30 characters).", "Articles can be up to 8000 characters."),
  keywords: z.string().max(300, "Keywords can be up to 300 characters.").optional().default(""),
});
