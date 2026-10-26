import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "./errors";

// Customer portal data: products, addresses, orders and chats.
// Row Level Security makes every read return only the signed-in customer's own rows
// (staff see everything). Every change goes through a database function.

export type Product = { product_id: string; sku: string; name: string; category: string; description: string; price_cents: number; stock: number };
export type Address = {
  address_id: string; label: string; recipient: string; line1: string; line2: string | null;
  suburb: string; state: string; postcode: string; phone: string | null; is_default: boolean;
};
export type OrderItem = { order_item_id: string; product_id: string | null; product_name: string; category: string; unit_price_cents: number; quantity: number; line_total_cents: number };
export type OrderEvent = { event_id: string; status: string; note: string | null; created_at: string };
export type Order = {
  order_id: string; order_number: string; status: string; ship_recipient: string; ship_address: string;
  subtotal_cents: number; shipping_cents: number; total_cents: number; notes: string | null;
  tracking_number: string | null; created_at: string; updated_at: string; order_items: OrderItem[];
};
export type OrderDetail = Order & { return_requests: { return_id: string; return_number: string; kind: string; status: string }[]; order_events: OrderEvent[]; cases: { case_id: string; case_number: string; status: string; subject: string | null; created_at: string }[] };
export type Chat = {
  case_id: string; case_number: string; subject: string | null; status: string; intent: string | null;
  created_at: string; updated_at: string; order: { order_id: string; order_number: string } | null;
  last: { content: string; sender_type: string; sent_at: string } | null; count: number;
};
export type ChatMessage = { message_id: string; sender_type: string; content: string; message_type: string; sent_at: string };

export const oneLine = (a: Pick<Address, "line1" | "line2" | "suburb" | "state" | "postcode">) =>
  [a.line1, a.line2, `${a.suburb} ${a.state} ${a.postcode}`].filter(Boolean).join(", ");

async function rpc(fn: string, args: Record<string, unknown>, context: string): Promise<{ data?: unknown; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { error: error.code === "22023" ? error.message : friendlyError(error, context) };
  return { data };
}

// ---------- products ----------
export async function listProducts(): Promise<Product[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("products")
    .select("product_id, sku, name, category, description, price_cents, stock").eq("active", true).order("category").order("name");
  if (error) console.error("[listProducts]", error.message);
  return (data ?? []) as Product[];
}

// ---------- addresses ----------
export async function listAddresses(): Promise<Address[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("customer_addresses")
    .select("address_id, label, recipient, line1, line2, suburb, state, postcode, phone, is_default")
    .order("is_default", { ascending: false }).order("created_at");
  if (error) console.error("[listAddresses]", error.message);
  return (data ?? []) as Address[];
}
export const saveAddress = (a: { id: string | null; label: string; recipient: string; line1: string; line2: string; suburb: string; state: string; postcode: string; phone: string; isDefault: boolean }) =>
  rpc("save_address", {
    p_address_id: a.id, p_label: a.label, p_recipient: a.recipient, p_line1: a.line1, p_line2: a.line2,
    p_suburb: a.suburb, p_state: a.state, p_postcode: a.postcode, p_phone: a.phone, p_default: a.isDefault,
  }, "saveAddress");
export const deleteAddress = (id: string) => rpc("delete_address", { p_address_id: id }, "deleteAddress");
export const setDefaultAddress = (id: string) => rpc("set_default_address", { p_address_id: id }, "setDefaultAddress");

// ---------- orders ----------
const ORDER_COLS = "order_id, order_number, status, ship_recipient, ship_address, subtotal_cents, shipping_cents, total_cents, notes, tracking_number, created_at, updated_at, order_items(order_item_id, product_id, product_name, category, unit_price_cents, quantity, line_total_cents)";

export async function listMyOrders(): Promise<Order[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("orders").select(ORDER_COLS).order("created_at", { ascending: false });
  if (error) console.error("[listMyOrders]", error.message);
  return (data ?? []) as Order[];
}

export async function getOrder(id: string): Promise<OrderDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("orders")
    .select(`${ORDER_COLS}, order_events(event_id, status, note, created_at), cases(case_id, case_number, status, subject, created_at), return_requests(return_id, return_number, kind, status)`)
    .eq("order_id", id).maybeSingle();
  if (error) console.error("[getOrder]", error.message);
  if (!data) return null;
  const o = data as OrderDetail;
  o.order_events.sort((a, b) => a.created_at.localeCompare(b.created_at));
  o.cases.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return o;
}

export const placeOrder = (addressId: string, items: { product_id: string; quantity: number }[], notes: string) =>
  rpc("place_order", { p_address_id: addressId, p_items: items, p_notes: notes }, "placeOrder");
export const cancelOrder = (id: string) => rpc("cancel_order", { p_order_id: id }, "cancelOrder");
export const askAboutOrder = (id: string, message: string) => rpc("ask_about_order", { p_order_id: id, p_message: message }, "askAboutOrder");

// ---------- chat history ----------
export async function listMyChats(): Promise<Chat[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("cases")
    .select("case_id, case_number, subject, status, intent, created_at, updated_at, orders(order_id, order_number), conversations(messages(content, sender_type, sent_at))")
    .order("created_at", { ascending: false });
  if (error) console.error("[listMyChats]", error.message);
  type Row = Omit<Chat, "order" | "last" | "count"> & {
    orders: { order_id: string; order_number: string } | null;
    conversations: { messages: { content: string; sender_type: string; sent_at: string }[] }[];
  };
  return ((data ?? []) as unknown as Row[]).map((r) => {
    const msgs = r.conversations.flatMap((c) => c.messages).sort((a, b) => a.sent_at.localeCompare(b.sent_at));
    const { orders, conversations: _c, ...rest } = r;
    void _c;
    return { ...rest, order: orders, last: msgs.at(-1) ?? null, count: msgs.length };
  });
}

export async function getChat(caseId: string): Promise<(Chat & { messages: ChatMessage[]; conversation_ids: string[] }) | null> {
  if (!/^[0-9a-f-]{36}$/i.test(caseId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("cases")
    .select("case_id, case_number, subject, status, intent, created_at, updated_at, orders(order_id, order_number), conversations(conversation_id, messages(message_id, sender_type, content, message_type, sent_at))")
    .eq("case_id", caseId).maybeSingle();
  if (error) console.error("[getChat]", error.message);
  if (!data) return null;
  const r = data as unknown as Omit<Chat, "order" | "last" | "count"> & {
    orders: { order_id: string; order_number: string } | null; conversations: { conversation_id: string; messages: ChatMessage[] }[];
  };
  const messages = r.conversations.flatMap((c) => c.messages).sort((a, b) => a.sent_at.localeCompare(b.sent_at));
  return {
    case_id: r.case_id, case_number: r.case_number, subject: r.subject, status: r.status, intent: r.intent,
    created_at: r.created_at, updated_at: r.updated_at, order: r.orders,
    last: messages.at(-1) ?? null, count: messages.length, messages, conversation_ids: r.conversations.map((c) => c.conversation_id),
  };
}
export const customerReply = (caseId: string, message: string) => rpc("customer_reply", { p_case_id: caseId, p_message: message }, "customerReply");

// ---------- staff ----------
export type QueueOrder = {
  order_id: string; order_number: string; status: string; total_cents: number; tracking_number: string | null;
  created_at: string; updated_at: string; ship_recipient: string; ship_address: string;
  customer_name: string; customer_email: string; item_count: number; open_cases: number;
};
export async function listOrderQueue(): Promise<{ data: QueueOrder[]; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("v_order_queue").select("*").order("created_at", { ascending: false });
  if (error) return { data: [], error: friendlyError(error, "listOrderQueue") };
  return { data: data as QueueOrder[] };
}
export const staffUpdateOrder = (id: string, status: string, tracking: string) =>
  rpc("staff_update_order", { p_order_id: id, p_status: status, p_tracking: tracking }, "staffUpdateOrder");
