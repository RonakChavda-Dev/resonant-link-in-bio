// Single-series daily bar chart (one measure per chart — never dual-axis).
// Thin bars with 4px rounded tops anchored to the baseline, 2px gaps,
// recessive grid, full-height hover/focus targets and a tooltip.
import { useId, useState } from "react";

export interface DayPoint {
  day: string; // YYYY-MM-DD
  value: number;
}

function niceMax(max: number) {
  if (max <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(max));
  const steps = [1, 2, 2.5, 5, 10];
  for (const s of steps) if (s * pow >= max) return s * pow;
  return 10 * pow;
}

const fmtDay = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" });

export function DailyBars({ title, unit, points }: { title: string; unit: string; points: DayPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const id = useId();
  const W = 1000;
  const H = 200;
  const padL = 32;
  const padB = 22;
  const padT = 10;
  const plotW = W - padL;
  const plotH = H - padB - padT;
  const max = niceMax(Math.max(0, ...points.map((p) => p.value)));
  const slot = plotW / points.length;
  const gap = 2;
  const barW = Math.max(2, Math.min(18, slot - gap));
  const total = points.reduce((s, p) => s + p.value, 0);
  const ticks = [0, max / 2, max];
  const active = hover !== null ? points[hover] : null;

  return (
    <figure className="card p-5" aria-labelledby={`${id}-t`}>
      <figcaption className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id={`${id}-t`} className="text-sm font-medium">{title}</h2>
        <p className="font-mono text-2xl tracking-tight">
          {total.toLocaleString()} <span className="text-xs text-faint">{unit} · 30 days</span>
        </p>
      </figcaption>
      <div className="relative mt-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`${title}: ${total} ${unit} over the last 30 days. Use the table below for daily values.`}>
          {ticks.map((t) => {
            const y = padT + plotH - (t / max) * plotH;
            return (
              <g key={t}>
                <line x1={padL} x2={W} y1={y} y2={y} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
                <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="10" fill="var(--color-faint)" fontFamily="var(--font-mono)">
                  {Number.isInteger(t) ? t : t.toFixed(1)}
                </text>
              </g>
            );
          })}
          {points.map((p, i) => {
            const h = max ? (p.value / max) * plotH : 0;
            const x = padL + i * slot + (slot - barW) / 2;
            const y = padT + plotH - h;
            const r = Math.min(4, barW / 2, h);
            return (
              <g key={p.day}>
                {h > 0 ? (
                  <path
                    d={`M${x},${padT + plotH} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${padT + plotH} Z`}
                    fill="var(--color-volt)"
                    opacity={hover === null || hover === i ? 1 : 0.45}
                  />
                ) : null}
                <rect
                  x={padL + i * slot}
                  y={padT}
                  width={slot}
                  height={plotH}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                />
              </g>
            );
          })}
          <line x1={padL} x2={W} y1={padT + plotH} y2={padT + plotH} stroke="rgba(255,255,255,0.18)" />
          {[0, Math.floor(points.length / 2), points.length - 1].map((i) =>
            points[i] ? (
              <text key={i} x={i === 0 ? padL : i === points.length - 1 ? W : padL + i * slot + slot / 2} y={H - 6} textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"} fontSize="10" fill="var(--color-faint)" fontFamily="var(--font-mono)">
                {fmtDay(points[i].day)}
              </text>
            ) : null,
          )}
        </svg>
        {active && hover !== null ? (
          <div
            className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-lg border border-line-strong bg-ink px-2.5 py-1.5 text-xs shadow-xl"
            style={{ left: `${((padL + hover * slot + slot / 2) / W) * 100}%` }}
          >
            <span className="text-dim">{fmtDay(active.day)}</span>{" "}
            <span className="font-mono text-fg">{active.value.toLocaleString()}</span> <span className="text-faint">{unit}</span>
          </div>
        ) : null}
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-dim hover:text-fg">Show as table</summary>
        <table className="mt-3 w-full text-left text-xs">
          <thead>
            <tr className="text-faint"><th className="py-1 font-normal">Day</th><th className="py-1 text-right font-normal">{unit}</th></tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.day} className="border-t border-line">
                <td className="py-1 text-dim">{fmtDay(p.day)}</td>
                <td className="py-1 text-right font-mono">{p.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
