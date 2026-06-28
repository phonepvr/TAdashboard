/** Small presentational primitives shared across views. */
import type { ReactNode } from 'react';

/**
 * Accessible "ⓘ" info tooltip explaining a metric's formula/logic. Pure CSS
 * (hover + keyboard focus), so it works offline and survives the strict CSP.
 * Hidden by default → never appears in PNG/PDF exports.
 */
export function InfoTip({ text, label }: { text: string; label?: string }) {
  return (
    <span className="no-print group relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label ?? 'How this is calculated'}
        onClick={(e) => e.stopPropagation()}
        className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-slate-300 text-[9px] font-semibold leading-none text-slate-400 transition-colors hover:border-brand-400 hover:text-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        i
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-30 hidden w-60 -translate-x-1/2 translate-y-1.5 rounded-lg border border-slate-200 bg-white p-2 text-left text-[11px] font-normal normal-case leading-snug tracking-normal text-slate-600 shadow-lg group-hover:block group-focus-within:block"
      >
        {text}
      </span>
    </span>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card p-4 ${className}`}>{children}</div>;
}

export function SectionTitle({
  children,
  hint,
  info,
  action,
}: {
  children: ReactNode;
  hint?: string;
  info?: string;
  /** right-aligned controls (e.g. a CSV export button). */
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-slate-600">
        {children}
        {info && <InfoTip text={info} />}
      </h2>
      <div className="flex shrink-0 items-center gap-2">
        {hint && <span className="hidden text-xs text-slate-400 md:inline">{hint}</span>}
        {action}
      </div>
    </div>
  );
}

/** A small "↓ CSV" button for exporting the data behind a card. */
export function CsvButton({ onClick, label = 'CSV' }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Download this card’s data as CSV"
      className="no-print inline-flex items-center gap-1 rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 transition-colors hover:border-brand-400 hover:bg-brand-50 hover:text-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      <span aria-hidden>↓</span> {label}
    </button>
  );
}

export function Stat({
  label,
  value,
  sub,
  info,
  onClick,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  info?: string;
  /** when set, the tile becomes a button that drills into the rows behind it. */
  onClick?: () => void;
}) {
  const body = (
    <>
      <div className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-slate-500">
        <span>{label}</span>
        {info && <InfoTip text={info} label={`How ${label} is calculated`} />}
      </div>
      <div className="tabular mt-1 text-2xl font-semibold text-slate-900">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </>
  );
  if (!onClick) return <div className="card p-4">{body}</div>;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className="group card relative cursor-pointer p-4 transition-all hover:border-brand-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      {body}
      <span className="no-print absolute right-2 top-2 text-[11px] text-slate-300 transition-colors group-hover:text-brand-500" aria-hidden>
        ⤢
      </span>
    </div>
  );
}

type Tone = 'neutral' | 'good' | 'warn' | 'critical' | 'brand' | 'demo';
const TONE: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700',
  good: 'bg-good-50 text-good-600',
  warn: 'bg-warn-50 text-warn-600',
  critical: 'bg-critical-50 text-critical-600',
  brand: 'bg-brand-50 text-brand-700',
  demo: 'bg-demo-50 text-demo-600',
};

export function Chip({ children, tone = 'neutral' }: { children: ReactNode; tone?: Tone }) {
  return <span className={`chip ${TONE[tone]}`}>{children}</span>;
}

export function Bar({ value, tone = 'brand' }: { value: number; tone?: Tone }) {
  const fill: Record<Tone, string> = {
    neutral: 'bg-slate-400',
    good: 'bg-good-500',
    warn: 'bg-warn-500',
    critical: 'bg-critical-500',
    brand: 'bg-brand-500',
    demo: 'bg-demo-500',
  };
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className={`h-full rounded-full ${fill[tone]}`}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function ProgressBar({ pct, phase }: { pct: number; phase?: string }) {
  return (
    <div className="w-full max-w-md">
      <div className="mb-2 flex justify-between text-xs text-slate-500">
        <span className="capitalize">{phase ?? 'working'}…</span>
        <span className="tabular">{Math.round(pct)}%</span>
      </div>
      <Bar value={pct} />
    </div>
  );
}

export function ScoreBadge({ score }: { score: number }) {
  const tone: Tone = score >= 80 ? 'good' : score >= 60 ? 'warn' : 'critical';
  return (
    <div className="flex items-center gap-2">
      <span className={`chip ${TONE[tone]} text-sm`}>{score}/100</span>
    </div>
  );
}
