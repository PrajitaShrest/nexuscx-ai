// Thumbnails of return photos. Links are short-lived signed URLs made on the server.
export default function PhotoStrip({ paths, urls, size = 64 }: { paths: string[] | null; urls: Record<string, string>; size?: number }) {
  const shown = (paths ?? []).filter((p) => urls[p]);
  if (shown.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {shown.map((p, i) => (
        <a key={p} href={urls[p]} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border bg-gray-50 hover:ring-2 hover:ring-indigo-300"
          style={{ width: size, height: size }} aria-label={`Open photo ${i + 1} in a new tab`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={urls[p]} alt={`Customer photo ${i + 1}`} className="h-full w-full object-cover" />
        </a>
      ))}
    </div>
  );
}
