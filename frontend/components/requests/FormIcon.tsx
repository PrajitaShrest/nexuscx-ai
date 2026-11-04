import { BookIcon, CardIcon, IdCardIcon, MapPinIcon, PackageIcon, TruckIcon } from "@/components/Icons";

// The icon and colour for each kind of form (request_types.icon)
const ICONS: Record<string, { icon: (c: string) => React.ReactNode; tint: string }> = {
  idcard: { icon: (c) => <IdCardIcon className={c} />, tint: "bg-violet-50 text-violet-600 ring-violet-100" },
  letter: { icon: (c) => <BookIcon className={c} />, tint: "bg-sky-50 text-sky-600 ring-sky-100" },
  document: { icon: (c) => <CardIcon className={c} />, tint: "bg-emerald-50 text-emerald-600 ring-emerald-100" },
  car: { icon: (c) => <MapPinIcon className={c} />, tint: "bg-amber-50 text-amber-600 ring-amber-100" },
  truck: { icon: (c) => <TruckIcon className={c} />, tint: "bg-sky-50 text-sky-600 ring-sky-100" },
};

export default function FormIcon({ icon, size = "md" }: { icon: string; size?: "sm" | "md" }) {
  const i = ICONS[icon] ?? { icon: (c: string) => <PackageIcon className={c} />, tint: "bg-slate-50 text-slate-600 ring-slate-100" };
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-xl ring-1 ${i.tint} ${size === "sm" ? "h-9 w-9" : "h-11 w-11"}`}>
      {i.icon(size === "sm" ? "h-4 w-4" : "h-5 w-5")}
    </span>
  );
}
