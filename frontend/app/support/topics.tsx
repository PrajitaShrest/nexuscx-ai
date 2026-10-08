import type { ReactNode } from "react";
import { CardIcon, HelpIcon, PackageIcon, ReturnIcon, UserIcon, WrenchIcon } from "@/components/Icons";

// The help topics a customer can pick, with starter questions.
// Starter questions go to the AI like any message, so answers always
// come from the approved knowledge base.
export type Topic = { id: string; label: string; blurb: string; icon: ReactNode; tint: string; questions: string[] };

export const TOPICS: Topic[] = [
  { id: "orders", label: "Orders & Delivery", blurb: "Track a parcel or change an order", icon: <PackageIcon className="h-6 w-6" />,
    tint: "bg-sky-50 text-sky-600 ring-sky-200",
    questions: ["Where is my order?", "My parcel hasn't arrived yet", "Can I change my delivery address?"] },
  { id: "billing", label: "Billing & Payments", blurb: "Invoices, charges and refunds", icon: <CardIcon className="h-6 w-6" />,
    tint: "bg-emerald-50 text-emerald-600 ring-emerald-200",
    questions: ["I need a copy of my invoice", "I was charged twice", "How do I update my payment method?"] },
  { id: "returns", label: "Returns", blurb: "Send something back or swap it", icon: <ReturnIcon className="h-6 w-6" />,
    tint: "bg-amber-50 text-amber-600 ring-amber-200",
    questions: ["How do I return an item?", "Can I exchange for a different size?", "When will my return be processed?"] },
  { id: "technical", label: "Technical Help", blurb: "Login, app or website problems", icon: <WrenchIcon className="h-6 w-6" />,
    tint: "bg-orange-50 text-orange-600 ring-orange-200",
    questions: ["I can't log in to my account", "The app keeps crashing", "I forgot my password"] },
  { id: "account", label: "My Account", blurb: "Profile, email and settings", icon: <UserIcon className="h-6 w-6" />,
    tint: "bg-violet-50 text-violet-600 ring-violet-200",
    questions: ["How do I change my email address?", "How do I update my profile?", "How do I close my account?"] },
  { id: "other", label: "Something Else", blurb: "Tell us in your own words", icon: <HelpIcon className="h-6 w-6" />,
    tint: "bg-slate-100 text-slate-600 ring-slate-200",
    questions: ["I have a question about a product", "I'd like to give feedback"] },
];

// Which topic a case belongs to (from the AI's intent)
export function topicForIntent(intent: string | null): Topic {
  const id = { order_status: "orders", billing_question: "billing", refund_request: "billing", return_request: "returns",
    technical_issue: "technical", account: "account" }[intent ?? ""] ?? "other";
  return TOPICS.find((t) => t.id === id)!;
}

// Friendly status words for customers (staff see the technical ones)
export const CUSTOMER_STATUS: Record<string, { label: string; style: string; step: number }> = {
  ai_handling: { label: "Answered by AI", style: "bg-indigo-50 text-indigo-700 ring-indigo-200", step: 2 },
  escalated: { label: "With a specialist", style: "bg-amber-50 text-amber-800 ring-amber-200", step: 2 },
  human_handling: { label: "Agent working on it", style: "bg-sky-50 text-sky-700 ring-sky-200", step: 2 },
  waiting: { label: "Waiting for you", style: "bg-rose-50 text-rose-700 ring-rose-200", step: 2 },
  resolved: { label: "Resolved", style: "bg-emerald-50 text-emerald-700 ring-emerald-200", step: 3 },
  closed: { label: "Closed", style: "bg-slate-100 text-slate-600 ring-slate-200", step: 3 },
};
