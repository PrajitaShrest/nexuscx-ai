"use client";

import { useEffect, useRef } from "react";

// Put at the end of a message list: keeps the newest message in view when one arrives.
export default function ScrollToEnd({ count }: { count: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [count]);
  return <div ref={ref} aria-hidden="true" />;
}
