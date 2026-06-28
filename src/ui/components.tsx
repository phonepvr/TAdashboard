/** Small presentational primitives shared across views. */
import type { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card p-4 ${className}`}>{children}</div>;
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">{children}</h2>
      {hint && <span className="text-xs text-slate-400">{hint}</span>}
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="tabular mt-1 text-2xl font-semibold text-slate-900">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
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
