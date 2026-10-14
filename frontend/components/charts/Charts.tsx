"use client";

import { useState } from "react";
import { INK } from "./palette";

// Small hand-built SVG charts: no chart library, so nothing extra to load.
// Every chart has a legend or labels, a hover/focus tooltip and a table view,
// so colour is never the only way to read a value.

type Series = { key: string; label: string; color: string };

function niceMax(v: number) {
  if (v <= 4) return 4;
  const step = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / step) * step;
}

const shortDay = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short" });

function Legend({ series, totals }: { series: Series[]; totals?: Record<string, number> }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-2 text-gray-700">
          <span aria-hidden className="h-0.5 w-4 rounded-full" style={{ background: s.color, height: 3 }} />
          {s.label}{totals && <span className="font-semibold text-gray-900">{totals[s.key]}</span>}
        </li>
      ))}
    </ul>
  );
}

function TableView({ caption, head, rows }: { caption: string; head: string[]; rows: (string | number)[][] }) {
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-xs font-semibold text-indigo-700">Show as table</summary>
      <div className="mt-2 max-h-64 overflow-auto rounded-lg border">
        <table className="w-full text-left tabular-nums">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 bg-gray-50 text-xs text-gray-500"><tr>{head.map((h) => <th key={h} className="px-3 py-1.5">{h}</th>)}</tr></thead>
          <tbody className="divide-y">{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="px-3 py-1">{c}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </details>
  );
}

// Line chart over days with a crosshair that snaps to the nearest day.
export function TrendChart({ data, series, title }: { data: ({ day: string } & Record<string, number | string>)[]; series: Series[]; title: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720, H = 240, L = 34, R = 12, T = 12, B = 26;
  const iw = W - L - R, ih = H - T - B;
  const max = niceMax(Math.max(1, ...data.flatMap((d) => series.map((s) => Number(d[s.key])))));
  const x = (i: number) => L + (data.length <= 1 ? iw / 2 : (i / (data.length - 1)) * iw);
  const y = (v: number) => T + ih - (v / max) * ih;
  const ticks = [0, max / 2, max];
  const labelEvery = Math.ceil(data.length / 7);
  const totals = Object.fromEntries(series.map((s) => [s.key, data.reduce((a, d) => a + Number(d[s.key]), 0)]));

  function pick(clientX: number, el: SVGSVGElement) {
    const r = el.getBoundingClientRect();
    const px = ((clientX - r.left) / r.width) * W;
    const i = Math.round(((px - L) / iw) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  }

  const h = hover !== null ? data[hover] : null;
  return (
    <figure>
      <Legend series={series} totals={totals} />
      <div className="relative mt-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full touch-none" role="img" aria-label={title} tabIndex={0}
          onPointerMove={(e) => pick(e.clientX, e.currentTarget)} onPointerLeave={() => setHover(null)}
          onFocus={() => setHover(data.length - 1)} onBlur={() => setHover(null)}
          onKeyDown={(e) => { if (e.key === "ArrowLeft") setHover((v) => Math.max(0, (v ?? 0) - 1)); if (e.key === "ArrowRight") setHover((v) => Math.min(data.length - 1, (v ?? 0) + 1)); }}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={t === 0 ? INK.base : INK.grid} strokeWidth={1} />
              <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill={INK.muted}>{Math.round(t)}</text>
            </g>
          ))}
          {data.map((d, i) => (i % labelEvery === 0 || i === data.length - 1) && (
            <text key={d.day} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"} fontSize={11} fill={INK.muted}>{shortDay(d.day)}</text>
          ))}
          {series.map((s) => (
            <path key={s.key} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
              d={data.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(Number(d[s.key]))}`).join(" ")} />
          ))}
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={T} y2={T + ih} stroke={INK.muted} strokeWidth={1} />
              {series.map((s) => <circle key={s.key} cx={x(hover)} cy={y(Number(data[hover][s.key]))} r={4.5} fill={s.color} stroke="#fff" strokeWidth={2} />)}
            </g>
          )}
        </svg>
        {h && hover !== null && (
          <div className="pointer-events-none absolute top-0 z-10 rounded-lg border bg-white px-3 py-2 text-xs shadow-lg"
            style={{ left: `${(x(hover) / W) * 100}%`, transform: `translateX(${hover > data.length / 2 ? "-110%" : "10%"})` }}>
            <p className="mb-1 font-medium text-gray-500">{shortDay(h.day)}</p>
            {series.map((s) => (
              <p key={s.key} className="flex items-center gap-2 whitespace-nowrap">
                <span aria-hidden className="inline-block w-3 rounded-full" style={{ background: s.color, height: 3 }} />
                <span className="font-semibold text-gray-900">{h[s.key]}</span><span className="text-gray-600">{s.label}</span>
              </p>
            ))}
          </div>
        )}
      </div>
      <TableView caption={title} head={["Day", ...series.map((s) => s.label)]} rows={data.map((d) => [shortDay(d.day), ...series.map((s) => d[s.key] as number)])} />
    </figure>
  );
}

// One 100% bar split into parts, with the legend carrying the numbers.
export function StackBar({ parts, title }: { parts: { key: string; label: string; value: number; color: string }[]; title: string }) {
  const [hover, setHover] = useState<string | null>(null);
  const total = parts.reduce((a, p) => a + p.value, 0);
  const pct = (v: number) => (total ? Math.round((v / total) * 100) : 0);
  return (
    <figure aria-label={title}>
      <div className="flex h-7 w-full gap-[2px] overflow-hidden rounded-md bg-gray-100">
        {total > 0 && parts.filter((p) => p.value > 0).map((p) => (
          <button key={p.key} type="button" aria-label={`${p.label}: ${p.value} (${pct(p.value)}%)`}
            onPointerEnter={() => setHover(p.key)} onPointerLeave={() => setHover(null)} onFocus={() => setHover(p.key)} onBlur={() => setHover(null)}
            className="h-full transition-opacity" style={{ width: `${(p.value / total) * 100}%`, background: p.color, opacity: hover && hover !== p.key ? 0.45 : 1 }} />
        ))}
      </div>
      <ul className="mt-3 space-y-1.5 text-sm">
        {parts.map((p) => (
          <li key={p.key} className={`flex items-center gap-2 rounded px-1 ${hover === p.key ? "bg-gray-50" : ""}`}>
            <span aria-hidden className="h-3 w-3 rounded-sm" style={{ background: p.color }} />
            <span className="flex-1 text-gray-700">{p.label}</span>
            <span className="font-semibold tabular-nums">{p.value}</span>
            <span className="w-10 text-right text-xs text-gray-500 tabular-nums">{pct(p.value)}%</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

// Horizontal bars, each split into a "part" and the rest (e.g. escalated vs not).
export function SplitBars({ rows, partLabel, restLabel, partColor, restColor, title }: {
  rows: { label: string; part: number; total: number; note?: string }[]; partLabel: string; restLabel: string; partColor: string; restColor: string; title: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...rows.map((r) => r.total));
  if (rows.length === 0) return <p className="text-sm text-gray-500">No cases in this period.</p>;
  return (
    <figure aria-label={title}>
      <Legend series={[{ key: "rest", label: restLabel, color: restColor }, { key: "part", label: partLabel, color: partColor }]} />
      <ul className="mt-3 space-y-3">
        {rows.map((r, i) => (
          <li key={r.label} className="text-sm">
            <div className="mb-1 flex justify-between gap-2"><span className="text-gray-700">{r.label}</span><span className="text-xs text-gray-500">{r.note}</span></div>
            <button type="button" className="relative flex h-3.5 w-full items-center" aria-label={`${r.label}: ${r.total} cases, ${r.part} ${partLabel.toLowerCase()}`}
              onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}>
              <span className="flex h-full gap-[2px]" style={{ width: `${(r.total / max) * 100}%` }}>
                {r.total - r.part > 0 && <span className="h-full rounded-l-sm" style={{ flex: r.total - r.part, background: restColor, borderTopRightRadius: r.part ? 0 : 4, borderBottomRightRadius: r.part ? 0 : 4 }} />}
                {r.part > 0 && <span className="h-full rounded-r" style={{ flex: r.part, background: partColor, borderTopLeftRadius: r.total - r.part ? 0 : 2, borderBottomLeftRadius: r.total - r.part ? 0 : 2 }} />}
              </span>
              <span className="ml-2 text-xs font-semibold tabular-nums text-gray-900">{r.total}</span>
              {hover === i && (
                <span className="pointer-events-none absolute -top-9 left-0 z-10 whitespace-nowrap rounded-lg border bg-white px-2.5 py-1 text-xs shadow-lg">
                  <b>{r.total - r.part}</b> {restLabel.toLowerCase()} · <b>{r.part}</b> {partLabel.toLowerCase()}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
      <TableView caption={title} head={["Topic", "Cases", partLabel, restLabel]} rows={rows.map((r) => [r.label, r.total, r.part, r.total - r.part])} />
    </figure>
  );
}

// Simple labelled bars where each bar has its own colour (used for sentiment).
export function LabelBars({ rows, title, wideLabels }: { rows: { label: string; value: number; color: string }[]; title: string; wideLabels?: boolean }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((a, r) => a + r.value, 0);
  return (
    <figure aria-label={title}>
      <ul className="space-y-2.5">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-3 text-sm" title={`${r.label}: ${r.value}`}>
            <span className={`${wideLabels ? "w-40" : "w-20"} shrink-0 truncate text-gray-700`} title={r.label}>{r.label}</span>
            <span className="flex h-3.5 flex-1 items-center">
              <span className="h-full rounded-r" style={{ width: `${(r.value / max) * 100}%`, minWidth: r.value ? 4 : 0, background: r.color }} />
              <span className="ml-2 text-xs font-semibold tabular-nums">{r.value}</span>
            </span>
            <span className="w-10 text-right text-xs text-gray-500 tabular-nums">{total ? Math.round((r.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

// Single-series columns (e.g. cases by hour of day) with a hover/focus readout.
export function Columns({ values, labels, title, color, labelEvery = 1, unit = "cases" }: {
  values: number[]; labels: string[]; title: string; color: string; labelEvery?: number; unit?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(1, ...values));
  const total = values.reduce((a, v) => a + v, 0);
  const peak = values.indexOf(Math.max(...values));
  return (
    <figure aria-label={title}>
      <p className="mb-2 h-5 text-sm text-gray-600" aria-live="polite">
        {hover !== null ? <><b className="text-gray-900">{values[hover]}</b> {unit} · {labels[hover]}</>
          : total ? <>Busiest: <b className="text-gray-900">{labels[peak]}</b> ({values[peak]} {unit})</> : "No cases in this period."}
      </p>
      <div className="flex h-36 items-end gap-[2px] border-b" style={{ borderColor: INK.base }}>
        {values.map((v, i) => (
          <button key={i} type="button" aria-label={`${labels[i]}: ${v} ${unit}`} className="flex h-full flex-1 items-end"
            onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}>
            <span className="block w-full max-w-6 rounded-t mx-auto transition-opacity" style={{ height: `${(v / max) * 100}%`, minHeight: v ? 3 : 0, background: color, opacity: hover !== null && hover !== i ? 0.5 : 1 }} />
          </button>
        ))}
      </div>
      <div className="mt-1 flex gap-[2px] text-[10px] text-gray-500">
        {labels.map((l, i) => <span key={i} className="flex-1 text-center">{i % labelEvery === 0 ? l : ""}</span>)}
      </div>
      <TableView caption={title} head={["", unit.charAt(0).toUpperCase() + unit.slice(1)]} rows={labels.map((l, i) => [l, values[i]])} />
    </figure>
  );
}
