// "Change the size or colour on my order" (migration 025): shared by the chat pages and the order page.

// Words that mean "change the size or colour on my order"
export const CHANGE_REQUEST = /\b(change|swap|switch|exchange|wrong|different|bigger|smaller|instead)\b[\s\S]*\b(size|sizes|colou?r|band)\b|\b(size|colou?r|band)\b[\s\S]*\b(change|swap|switch|exchange|wrong|bigger|smaller|instead)\b/i;

// Words that mean "cancel my order" (031): offered only while the order has not shipped
export const CANCEL_REQUEST = /\bcancel(l?ed|l?ing|lation)?\b|\bdon'?t want (it|this|the order|my order) any ?more\b|\bstop (the|my) order\b/i;

const TWO_DAYS = 2 * 24 * 3600 * 1000;

// The AI can change it itself: placed in the last 2 days, not shipped, and an item has a size or colour
export function canChangeOrder(o: { status: string; created_at: string; order_items: { variant: string | null }[] }, now: number) {
  return ["placed", "processing"].includes(o.status) && now - new Date(o.created_at).getTime() < TWO_DAYS && o.order_items.some((i) => i.variant);
}
