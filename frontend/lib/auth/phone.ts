// Australian mobile: 04xx xxx xxx or +61 4xx xxx xxx -> +614xxxxxxxx
export function normaliseMobile(raw: string): string | null {
  const digits = raw.replace(/[\s()-]/g, "");
  if (/^04\d{8}$/.test(digits)) return `+61${digits.slice(1)}`;
  if (/^\+?614\d{8}$/.test(digits)) return `+${digits.replace(/^\+/, "")}`;
  return null;
}

// +61412345678 -> 0412 345 678 (for showing in a form)
export function displayMobile(stored: string | null): string {
  if (!stored) return "";
  const m = stored.match(/^\+614(\d{2})(\d{3})(\d{3})$/);
  return m ? `04${m[1]} ${m[2]} ${m[3]}` : stored;
}
