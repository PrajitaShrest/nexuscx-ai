// Tags and badges matching the Figma prototype
export const CATEGORY: Record<string, { label: string; style: string }> = {
  order_status: { label: "Order", style: "border-blue-300 bg-blue-50 text-blue-700" },
  return_request: { label: "Order", style: "border-blue-300 bg-blue-50 text-blue-700" },
  billing_question: { label: "Billing", style: "border-green-300 bg-green-50 text-green-700" },
  refund_request: { label: "Billing", style: "border-green-300 bg-green-50 text-green-700" },
  technical_issue: { label: "Technical", style: "border-orange-300 bg-orange-50 text-orange-700" },
  account: { label: "Account", style: "border-purple-300 bg-purple-50 text-purple-700" },
  general: { label: "General", style: "border-gray-300 bg-gray-50 text-gray-600" },
  unknown: { label: "General", style: "border-gray-300 bg-gray-50 text-gray-600" },
};

export const STATUS: Record<string, { label: string; style: string }> = {
  ai_handling: { label: "AI Handling", style: "border-indigo-300 bg-indigo-50 text-indigo-700" },
  human_handling: { label: "Human Handling", style: "border-sky-300 bg-sky-50 text-sky-700" },
  waiting: { label: "Waiting", style: "border-amber-300 bg-amber-50 text-amber-700" },
  escalated: { label: "Escalated", style: "border-red-300 bg-red-50 text-red-700" },
  resolved: { label: "Resolved", style: "border-emerald-300 bg-emerald-50 text-emerald-700" },
  closed: { label: "Closed", style: "border-gray-300 bg-gray-50 text-gray-600" },
};

export function Pill({ map, value }: { map: Record<string, { label: string; style: string }>; value: string | null }) {
  const v = map[value ?? ""] ?? { label: value ?? "—", style: "border-gray-300 bg-gray-50 text-gray-600" };
  return <span className={`rounded-full border px-2.5 py-0.5 text-xs ${v.style}`}>{v.label}</span>;
}

export function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}
