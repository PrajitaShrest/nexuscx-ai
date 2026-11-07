// A calendar file for "Add to my calendar" (30 minutes, works with Google, Apple and Outlook calendars)
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export function icsLink({ start, title, note }: { start: string; title: string; note: string }) {
  const from = new Date(start);
  const to = new Date(from.getTime() + 30 * 60 * 1000);
  const clean = (s: string) => s.replace(/[\\,;]/g, " ").replace(/\n/g, " ");
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//NexusCX//Appointments//EN", "BEGIN:VEVENT",
    `UID:${stamp(from)}-${Math.abs([...title].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7))}@nexuscx`,
    `DTSTAMP:${stamp(from)}`, `DTSTART:${stamp(from)}`, `DTEND:${stamp(to)}`,
    `SUMMARY:${clean(title)}`, `DESCRIPTION:${clean(note)}`, "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}
