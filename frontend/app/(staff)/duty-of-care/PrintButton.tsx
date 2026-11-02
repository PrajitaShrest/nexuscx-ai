"use client";

export default function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()}
      className="rounded-lg border bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
      Print or save as PDF
    </button>
  );
}
