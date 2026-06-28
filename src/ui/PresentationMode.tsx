/**
 * §10 Presentation / Review mode — a projector-friendly, page-by-page deck for
 * the HR-head walkthrough. Controls are hidden, type is enlarged, and slides are
 * navigated with the arrow keys (← →), Space, Home/End; Esc exits. Reuses the
 * analytical views so PII masking still applies.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useStore } from '../state/store';
import { ExecutiveSummary } from './ExecutiveSummary';
import { FunnelView } from './FunnelView';
import { AgeingView } from './AgeingView';
import { DiversitySourceView } from './DiversitySourceView';
import { RecruiterView } from './RecruiterView';
import { ForecastView } from './ForecastView';
import { DataQualityReadout } from './DataQualityReadout';

const SLIDES: { title: string; el: ReactNode }[] = [
  { title: 'Executive Summary', el: <ExecutiveSummary /> },
  { title: 'Funnel & Velocity', el: <FunnelView /> },
  { title: 'Ageing & TBO', el: <AgeingView /> },
  { title: 'Diversity & Source', el: <DiversitySourceView /> },
  { title: 'Recruiters', el: <RecruiterView /> },
  { title: 'Forecast', el: <ForecastView /> },
  { title: 'Data Quality', el: <DataQualityReadout /> },
];

export function PresentationMode() {
  const setPresenting = useStore((s) => s.setPresenting);
  const isDemo = useStore((s) => s.isDemo);
  const [i, setI] = useState(0);

  const go = useCallback((delta: number) => {
    setI((cur) => Math.max(0, Math.min(SLIDES.length - 1, cur + delta)));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPresenting(false);
      else if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        go(1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        go(-1);
      } else if (e.key === 'Home') setI(0);
      else if (e.key === 'End') setI(SLIDES.length - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, setPresenting]);

  const slide = SLIDES[i]!;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <header className="flex items-center justify-between border-b border-slate-200 px-6 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-slate-900">{slide.title}</h1>
          {isDemo && <span className="chip bg-demo-50 text-demo-600">DEMO DATA</span>}
        </div>
        <div className="flex items-center gap-4 text-sm text-slate-400">
          <span className="hidden sm:inline">← → navigate · Esc exit</span>
          <span className="tabular">{i + 1} / {SLIDES.length}</span>
          <button type="button" className="btn-ghost px-2.5 py-1 text-xs" onClick={() => setPresenting(false)}>
            Exit
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto" style={{ zoom: 1.12 }}>
        {slide.el}
      </div>

      <footer className="flex items-center justify-between border-t border-slate-200 px-6 py-2">
        <button type="button" className="btn-ghost px-3 py-1 text-sm disabled:opacity-30" onClick={() => go(-1)} disabled={i === 0}>
          ← Prev
        </button>
        <div className="flex gap-1.5">
          {SLIDES.map((s, idx) => (
            <button
              key={s.title}
              type="button"
              aria-label={`Go to ${s.title}`}
              onClick={() => setI(idx)}
              className={`h-2 w-2 rounded-full ${idx === i ? 'bg-brand-600' : 'bg-slate-300'}`}
            />
          ))}
        </div>
        <button type="button" className="btn-ghost px-3 py-1 text-sm disabled:opacity-30" onClick={() => go(1)} disabled={i === SLIDES.length - 1}>
          Next →
        </button>
      </footer>
    </div>
  );
}
