"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PlusIcon, XIcon } from "./Icons";

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic" };
const MAX = 3;
const MAX_BYTES = 5 * 1024 * 1024;

type Photo = { path: string; preview: string; name: string };

// Lets a customer add up to 3 photos. Each photo is uploaded straight to the private
// "return-photos" bucket, into a folder named after the customer's own user id
// (Storage rules refuse any other folder). The saved paths go into a hidden input.
export default function PhotoPicker({ name }: { name: string }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  async function add(files: FileList | null) {
    setError("");
    if (!files?.length) return;
    const list = [...files].slice(0, MAX - photos.length);
    if (files.length > list.length) setError(`You can add up to ${MAX} photos.`);
    const bad = list.find((f) => !TYPES[f.type] || f.size > MAX_BYTES);
    if (bad) { setError(`${bad.name}: please use a JPG, PNG, WebP or HEIC photo under 5 MB.`); return; }

    setBusy(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); setError("Please sign in again to add photos."); return; }
    const added: Photo[] = [];
    for (const f of list) {
      const path = `${user.id}/${crypto.randomUUID()}.${TYPES[f.type]}`;
      const { error: e } = await supabase.storage.from("return-photos").upload(path, f, { contentType: f.type, upsert: false });
      if (e) { setError("A photo could not be uploaded. Please try again."); break; }
      added.push({ path, preview: URL.createObjectURL(f), name: f.name });
    }
    setPhotos((p) => [...p, ...added]);
    setBusy(false);
    if (input.current) input.current.value = "";
  }

  return (
    <div>
      <input type="hidden" name={name} value={JSON.stringify(photos.map((p) => p.path))} />
      <div className="flex flex-wrap gap-3">
        {photos.map((p) => (
          <figure key={p.path} className="relative h-24 w-24 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.preview} alt={p.name} className="h-full w-full object-cover" />
            <button type="button" onClick={() => setPhotos((all) => all.filter((x) => x.path !== p.path))} aria-label={`Remove ${p.name}`}
              className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-slate-700 shadow hover:bg-white"><XIcon className="h-3.5 w-3.5" /></button>
          </figure>
        ))}
        {photos.length < MAX && (
          <label className={`flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 text-xs text-slate-500 hover:border-indigo-400 hover:text-indigo-600 ${busy ? "pointer-events-none opacity-60" : ""}`}>
            <PlusIcon className="h-5 w-5" />
            {busy ? "Uploading…" : "Add photo"}
            <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic" multiple className="sr-only" onChange={(e) => add(e.target.files)} disabled={busy} />
          </label>
        )}
      </div>
      <p className={`mt-2 text-xs ${error ? "text-bad" : "text-muted"}`} aria-live="polite">{error || `Optional. Up to ${MAX} photos, 5 MB each. Only you and our support team can see them.`}</p>
    </div>
  );
}
