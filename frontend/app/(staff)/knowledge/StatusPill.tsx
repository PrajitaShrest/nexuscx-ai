export const KB_STATUS: Record<string, { label: string; style: string }> = {
  draft: { label: "Draft", style: "border-gray-300 bg-gray-50 text-gray-600" },
  under_review: { label: "In review", style: "border-amber-300 bg-amber-50 text-amber-700" },
  approved: { label: "Approved", style: "border-emerald-300 bg-emerald-50 text-emerald-700" },
  disabled: { label: "Disabled", style: "border-red-300 bg-red-50 text-red-700" },
  archived: { label: "Archived", style: "border-gray-300 bg-gray-100 text-gray-500" },
};
export const KB_CATEGORY: Record<string, string> = { orders: "Orders & delivery", billing: "Billing & refunds", technical: "Technical", account: "Account", general: "General" };
