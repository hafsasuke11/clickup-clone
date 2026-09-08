import { useState } from 'react';

/**
 * Dependency-free chart primitives for the Dashboard. Deliberately restrained:
 * one mono-purple ramp + neutral tones, emphasis through size/weight rather
 * than colour.
 */

/** Strong → faint purple. Index 0 is the most prominent. */
export const RAMP = ['#6D4FE0', '#8B74E7', '#A594EC', '#C2B5F3', '#DAD1F8', '#EDE8FC'];

/** Evenly spread `n` colours across the ramp (max contrast for small n). */
export function rampColors(n: number): string[] {
  if (n <= 1) return [RAMP[0]];
  return Array.from({ length: n }, (_, i) => RAMP[Math.round((i / (n - 1)) * (RAMP.length - 1))]);
}

export interface Slice {
  label: string;
  value: number;
  /** Optional stable id passed back to `onSelect` (e.g. a status/priority key). */
  key?: string;
  /** Optional explicit colour; otherwise the ramp is used. */
  color?: string;
}

/* ── Donut ─────────────────────────────────────────────────────────────────── */

export function DonutChart({
  data,
  size = 116,
  thickness = 15,
  centerLabel = 'total',
  onSelect,
  hint,
}: {
  data: Slice[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  onSelect?: (slice: Slice, index: number) => void;
  hint?: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = (size - thickness - 6) / 2;
  const c = size / 2;
  const colors = data.map((d, i) => d.color ?? rampColors(data.length)[i]);

  let acc = 0;
  return (
    <div>
      <div className="flex items-center gap-5">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
            <circle cx={c} cy={c} r={r} fill="none" strokeWidth={thickness} stroke="#EEF0F4" />
            {total > 0 &&
              data.map((d, i) => {
                if (d.value <= 0) return null;
                const pct = (d.value / total) * 100;
                const dim = active !== null && active !== i;
                const el = (
                  <circle
                    key={i}
                    cx={c}
                    cy={c}
                    r={r}
                    fill="none"
                    stroke={colors[i]}
                    strokeWidth={active === i ? thickness + 4 : thickness}
                    pathLength={100}
                    strokeDasharray={`${Math.max(pct - 0.6, 0.4)} ${100 - Math.max(pct - 0.6, 0.4)}`}
                    strokeDashoffset={-acc}
                    style={{ opacity: dim ? 0.35 : 1, transition: 'opacity .15s, stroke-width .15s', cursor: onSelect ? 'pointer' : 'default' }}
                    onMouseEnter={() => setActive(i)}
                    onMouseLeave={() => setActive(null)}
                    onClick={() => onSelect?.(d, i)}
                  />
                );
                acc += pct;
                return el;
              })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[22px] font-bold text-text-primary leading-none tabular-nums">
              {active !== null ? data[active].value : total}
            </span>
            <span className="text-[10px] text-text-secondary mt-0.5 max-w-[72px] truncate text-center">
              {active !== null ? data[active].label : centerLabel}
            </span>
          </div>
        </div>

        <ul className="min-w-0 flex-1 space-y-0.5">
          {data.map((d, i) => {
            const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
            const Row = onSelect ? 'button' : 'div';
            return (
              <li key={i}>
                <Row
                  {...(onSelect ? { type: 'button' as const, onClick: () => onSelect(d, i) } : {})}
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                  className={`w-full flex items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors ${
                    onSelect ? 'hover:bg-black/[0.03] cursor-pointer' : ''
                  } ${active === i ? 'bg-black/[0.03]' : ''}`}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: colors[i] }} />
                  <span className="text-xs text-text-secondary truncate flex-1">{d.label}</span>
                  <span className="text-xs font-medium text-text-primary tabular-nums shrink-0">{d.value}</span>
                  <span className="text-[11px] text-text-disabled tabular-nums shrink-0 w-8 text-right">{pct}%</span>
                </Row>
              </li>
            );
          })}
        </ul>
      </div>
      {hint && <p className="text-[11px] text-text-disabled mt-3">{hint}</p>}
    </div>
  );
}

/* ── Radial gauge ──────────────────────────────────────────────────────────── */

export function RadialGauge({
  value, max, size = 116, thickness = 13, label = 'complete',
}: {
  value: number;
  max: number;
  size?: number;
  thickness?: number;
  label?: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const r = (size - thickness - 6) / 2;
  const c = size / 2;
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={c} cy={c} r={r} fill="none" strokeWidth={thickness} stroke="#EEF0F4" />
        {pct > 0 && (
          <circle
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke={RAMP[0]}
            strokeWidth={thickness}
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${pct} ${100 - pct}`}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-text-primary leading-none tabular-nums">{Math.round(pct)}%</span>
        <span className="text-[10px] text-text-secondary mt-0.5">{label}</span>
      </div>
    </div>
  );
}

/* ── Horizontal stacked bar ────────────────────────────────────────────────── */

export function StackedBar({
  data, onSelect,
}: {
  data: Slice[];
  onSelect?: (slice: Slice, index: number) => void;
}) {
  const [active, setActive] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  const colors = data.map((d, i) => d.color ?? rampColors(data.length)[i]);

  return (
    <div>
      <div className="flex h-2.5 w-full rounded-full overflow-hidden bg-[#EEF0F4]">
        {total > 0 &&
          data.map((d, i) =>
            d.value > 0 ? (
              <div
                key={i}
                style={{
                  width: `${(d.value / total) * 100}%`,
                  background: colors[i],
                  opacity: active !== null && active !== i ? 0.4 : 1,
                  transition: 'opacity .15s',
                }}
              />
            ) : null,
          )}
      </div>
      <ul className="mt-3 space-y-0.5">
        {data.map((d, i) => {
          const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
          const Row = onSelect ? 'button' : 'div';
          return (
            <li key={i}>
              <Row
                {...(onSelect ? { type: 'button' as const, onClick: () => onSelect(d, i) } : {})}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                className={`w-full flex items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors ${
                  onSelect ? 'hover:bg-black/[0.03] cursor-pointer' : ''
                } ${active === i ? 'bg-black/[0.03]' : ''}`}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: colors[i] }} />
                <span className="text-xs text-text-secondary truncate flex-1">{d.label}</span>
                <span className="text-xs font-medium text-text-primary tabular-nums shrink-0">{d.value}</span>
                <span className="text-[11px] text-text-disabled tabular-nums shrink-0 w-8 text-right">{pct}%</span>
              </Row>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ── Weekly bars ───────────────────────────────────────────────────────────── */

export interface DayBar {
  label: string;
  created: number;
  completed: number;
}

export function MiniBars({
  data,
  onSelect,
}: {
  data: DayBar[];
  /** Click a day's Created / Completed count for the task-level breakdown. */
  onSelect?: (day: DayBar, kind: 'created' | 'completed', index: number) => void;
}) {
  const BAR_AREA = 76;
  const max = Math.max(1, ...data.flatMap((d) => [d.created, d.completed]));
  const h = (v: number) => (v > 0 ? Math.max(3, Math.round((v / max) * BAR_AREA)) : 0);

  const seg = (d: DayBar, i: number, kind: 'created' | 'completed', color: string) => {
    const v = kind === 'created' ? d.created : d.completed;
    const bar = <div className="w-2 rounded-t" style={{ height: h(v), background: color }} />;
    const label = `${v} ${kind}`;
    if (!onSelect || v === 0) {
      return <div className="w-2 h-full flex items-end" title={label}>{bar}</div>;
    }
    return (
      <button
        type="button"
        onClick={() => onSelect(d, kind, i)}
        title={`${label} — view tasks`}
        className="w-2 h-full flex items-end cursor-pointer hover:opacity-70 transition-opacity focus:outline-none focus-visible:opacity-70"
      >
        {bar}
      </button>
    );
  };

  return (
    <div>
      <div className="flex items-end justify-between gap-2" style={{ height: BAR_AREA }}>
        {data.map((d, i) => (
          <div key={i} className="flex-1 h-full flex items-end justify-center gap-[3px] min-w-0">
            {seg(d, i, 'created', '#C2B5F3')}
            {seg(d, i, 'completed', RAMP[0])}
          </div>
        ))}
      </div>
      <div className="flex justify-between gap-2 mt-1.5 border-t border-border pt-1.5">
        {data.map((d, i) => (
          <span key={i} className="flex-1 text-center text-[10px] text-text-disabled">{d.label}</span>
        ))}
      </div>
    </div>
  );
}
