// Industry packs: one platform, set up for different kinds of business.
// Pure data (safe in client components). The active pack comes from
// lib/industry.ts; the database decides which agents, articles and cases
// belong to each pack (migration 017).

export type Industry = "ecommerce" | "university";

export type Pack = {
  id: Industry;
  label: string;          // name of the pack
  org: string;            // the demo organisation
  person: string;         // what we call the people asking for help
  people: string;
  account: string;        // badge in the customer menu
  assistant: string;      // chat assistant name
  shop: boolean;          // orders, returns, shop and addresses are shown
  blurb: string;
};

export const PACKS: Record<Industry, Pack> = {
  ecommerce: {
    id: "ecommerce", label: "E-commerce", org: "NexusCX Store", person: "Customer", people: "Customers",
    account: "Customer account", assistant: "NexusCX Assistant", shop: true,
    blurb: "Online store: orders, delivery, returns, billing and accounts.",
  },
  university: {
    id: "university", label: "University", org: "Northbridge University", person: "Student", people: "Students",
    account: "Student account", assistant: "Northbridge Student Assistant", shop: false,
    blurb: "Admissions, fees, IT support, academic (exams and results) and student services (ID cards, international students).",
  },
};

// The visitor's own choice of demo pack (saved in their browser, sent to the
// database as the x-nexus-industry header; migration 018)
export const CHOICE_COOKIE = "nx_industry";
export const CHOICE_HEADER = "x-nexus-industry";

export const isIndustry = (v: unknown): v is Industry => v === "ecommerce" || v === "university";

// Knowledge base categories per pack (also checked by save_knowledge_doc)
export const KB_CATS: Record<Industry, [string, string][]> = {
  ecommerce: [["orders", "Orders & delivery"], ["billing", "Billing & refunds"], ["technical", "Technical"], ["account", "Account"], ["general", "General"]],
  university: [["admissions", "Admissions"], ["fees", "Finance & fees"], ["it_support", "IT support"], ["academic", "Academic, exams & results"],
    ["student_services", "Student services"], ["general", "General"]],
};
export const ALL_KB_CATS = [...new Set(Object.values(KB_CATS).flat().map(([k]) => k))];
export const kbLabel = (c: string) => Object.values(KB_CATS).flat().find(([k]) => k === c)?.[1] ?? c;

export const LANGUAGE_NAME: Record<string, string> = {
  en: "English", ne: "Nepali", hi: "Hindi", zh: "Chinese", ja: "Japanese", ko: "Korean", ar: "Arabic", th: "Thai", vi: "Vietnamese", es: "Spanish",
};
