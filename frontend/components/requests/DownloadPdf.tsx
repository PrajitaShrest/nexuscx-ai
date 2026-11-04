"use client";

import { useState } from "react";

// "Download PDF": opens the browser's print window with only the result on the page
// (see .print-area in globals.css). Choosing "Save as PDF" saves it as a file.
// The file is named after the document, for example "Transcript TR-1003".
export default function DownloadPdf({ fileName }: { fileName: string }) {
  const [hint, setHint] = useState(false);
  function save() {
    const old = document.title;
    document.title = fileName;
    setHint(true);
    window.print();
    setTimeout(() => { document.title = old; }, 1000);
  }
  return (
    <div className="flex flex-col items-start gap-1 print:hidden sm:items-end">
      <button type="button" onClick={save}
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:brightness-110">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
          <path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" />
        </svg>
        Download PDF
      </button>
      <span className="text-xs text-muted">{hint ? "In the window that opens, choose “Save as PDF”." : "Saves a PDF you can keep, email or print."}</span>
    </div>
  );
}
