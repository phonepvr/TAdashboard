import { lazy, Suspense, useEffect } from 'react';
import { useStore } from './state/store';
import { TopBar } from './ui/TopBar';
import { FileLoader } from './ui/FileLoader';
import { MappingScreen } from './ui/MappingScreen';
import { FilterBar } from './ui/FilterBar';
import { ProgressBar } from './ui/components';
import type { AppView } from './state/store';

// Code-split the analytical views (Recharts is heavy) so the initial bundle —
// loader + mapping + privacy spine — stays small. Views load on demand.
const ExecutiveSummary = lazy(() => import('./ui/ExecutiveSummary').then((m) => ({ default: m.ExecutiveSummary })));
const ReviewMode = lazy(() => import('./ui/ReviewMode').then((m) => ({ default: m.ReviewMode })));
const FunnelView = lazy(() => import('./ui/FunnelView').then((m) => ({ default: m.FunnelView })));
const AgeingView = lazy(() => import('./ui/AgeingView').then((m) => ({ default: m.AgeingView })));
const DiversitySourceView = lazy(() => import('./ui/DiversitySourceView').then((m) => ({ default: m.DiversitySourceView })));
const RecruiterView = lazy(() => import('./ui/RecruiterView').then((m) => ({ default: m.RecruiterView })));
const ForecastView = lazy(() => import('./ui/ForecastView').then((m) => ({ default: m.ForecastView })));
const DataQualityReadout = lazy(() => import('./ui/DataQualityReadout').then((m) => ({ default: m.DataQualityReadout })));
const PresentationMode = lazy(() => import('./ui/PresentationMode').then((m) => ({ default: m.PresentationMode })));

const ViewFallback = () => (
  <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-400">Loading view…</div>
);

function Dashboard() {
  const activeView = useStore((s) => s.activeView);
  const setActiveView = useStore((s) => s.setActiveView);
  const tabs: { key: AppView; label: string }[] = [
    { key: 'exec', label: 'Executive' },
    { key: 'review', label: 'Review' },
    { key: 'funnel', label: 'Funnel & Velocity' },
    { key: 'ageing', label: 'Ageing & TBO' },
    { key: 'diversity', label: 'Diversity & Source' },
    { key: 'recruiters', label: 'Recruiters' },
    { key: 'forecast', label: 'Forecast' },
    { key: 'dq', label: 'Data Quality' },
  ];
  // The filter bar drives the analytical views; Review has its own head picker and
  // Data Quality is intentionally whole-dataset.
  const showFilter = activeView !== 'review' && activeView !== 'dq';
  return (
    <div>
      <div className="no-print flex flex-wrap gap-0.5 border-b-2 border-slate-200 bg-white px-4 pt-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-current={activeView === t.key ? 'page' : undefined}
            onClick={() => setActiveView(t.key)}
            className={`relative px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
              activeView === t.key
                ? 'text-brand-500'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
            {activeView === t.key && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500" />
            )}
          </button>
        ))}
      </div>
      {showFilter && <FilterBar />}
      <Suspense fallback={<ViewFallback />}>
        {activeView === 'exec' && <ExecutiveSummary />}
        {activeView === 'review' && <ReviewMode />}
        {activeView === 'funnel' && <FunnelView />}
        {activeView === 'ageing' && <AgeingView />}
        {activeView === 'diversity' && <DiversitySourceView />}
        {activeView === 'recruiters' && <RecruiterView />}
        {activeView === 'forecast' && <ForecastView />}
        {activeView === 'dq' && <DataQualityReadout />}
      </Suspense>
    </div>
  );
}

export function App() {
  const init = useStore((s) => s.init);
  const status = useStore((s) => s.status);
  const progress = useStore((s) => s.progress);
  const error = useStore((s) => s.error);
  const newSession = useStore((s) => s.newSession);
  const presenting = useStore((s) => s.presenting);

  useEffect(() => {
    void init();
  }, [init]);

  return (
    <div className="min-h-full">
      <TopBar />
      <main>
        {status === 'idle' && <FileLoader />}

        {(status === 'parsing' || status === 'normalizing') && (
          <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4">
            <ProgressBar pct={progress?.pct ?? 0} phase={progress?.phase} />
            <p className="text-xs text-slate-400">All processing happens in this browser.</p>
          </div>
        )}

        {status === 'mapping' && <MappingScreen />}

        {status === 'ready' &&
          (presenting ? (
            <Suspense fallback={<ViewFallback />}>
              <PresentationMode />
            </Suspense>
          ) : (
            <Dashboard />
          ))}

        {status === 'error' && (
          <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
            <h2 className="text-lg font-semibold text-critical-600">Something went wrong</h2>
            <p className="text-sm text-slate-500">{error}</p>
            <button type="button" className="btn-primary" onClick={newSession}>
              Try another file
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
