"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Watch = { table: string; filter?: string; event?: "INSERT" | "UPDATE" | "*" };

// Keeps a page up to date without the user pressing refresh.
// Listens to Supabase Realtime for changes the signed-in user is allowed to see
// (Row Level Security applies), then re-renders the page with fresh data.
// If Realtime is unavailable it falls back to checking every 20 seconds while the tab is open.
export default function LiveRefresh({ watch, name }: { watch: Watch[]; name: string }) {
  const router = useRouter();
  const [live, setLive] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveRef = useRef(false);
  const key = JSON.stringify(watch);

  useEffect(() => {
    const supabase = createClient();
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 300); // group bursts (message + status change)
    };
    let channel = supabase.channel(`live:${name}`);
    for (const w of JSON.parse(key) as Watch[]) {
      channel = channel.on("postgres_changes", { event: w.event ?? "*", schema: "public", table: w.table, ...(w.filter ? { filter: w.filter } : {}) }, refresh);
    }
    channel.subscribe((status) => { liveRef.current = status === "SUBSCRIBED"; setLive(liveRef.current); });
    const poll = setInterval(() => { if (document.visibilityState === "visible" && !liveRef.current) router.refresh(); }, 20000);
    return () => { clearInterval(poll); if (timer.current) clearTimeout(timer.current); supabase.removeChannel(channel); };
  }, [key, name, router]);


  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-500" title={live ? "New messages appear automatically" : "Checking for new messages every 20 seconds"}>
      <span aria-hidden className={`h-2 w-2 rounded-full ${live ? "bg-emerald-500" : "bg-gray-300"}`} />
      {live ? "Live" : "Auto-refresh"}
    </span>
  );
}
