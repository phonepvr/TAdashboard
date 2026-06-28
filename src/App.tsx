import { useEffect } from 'react';
import { useStore } from './state/store';
import { TopBar } from './ui/TopBar';
import { FileLoader } from './ui/FileLoader';
import { MappingScreen } from './ui/MappingScreen';
import { DataQualityReadout } from './ui/DataQualityReadout';
import { MetricsView } from './ui/MetricsView';
import { ExecutiveSummary } from './ui/ExecutiveSummary';
import { ReviewMode } from './ui/ReviewMode';
import { FilterBar } from './ui/FilterBar';
import { ProgressBar } from './ui/components';
import type { AppView } from './state/store';

function Dashboard() {
  const activeView = useStore((s) => s.activeView);
  const setActiveView = useStore((s) => s.setActiveView);
  const tabs: { key: AppView; label: string }[] = [
    { key: 'exec', label: 'Executive' },
    { key: 'review', label: 'Review' },
    { key: 'metrics', label: 'Metrics' },
    { key: 'dq', label: 'Data Quality' },
  ];
  const showFilter = activeView === 'exec' || activeView === 'metrics';
  return (
    <div>
      <div className="no-print flex gap-1 border-b border-slate-200 bg-white px-4 pt-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveView(t.key)}
            className={`rounded-t-lg px-3 py-1.5 text-sm font-medium ${
              activeView === t.key
                ? 'border border-b-white border-slate-200 bg-white text-brand-700'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {showFilter && <FilterBar />}
      {activeView === 'exec' && <ExecutiveSummary />}
      {activeView === 'review' && <ReviewMode />}
      {activeView === 'metrics' && <MetricsView />}
      {activeView === 'dq' && <DataQualityReadout />}
    </div>
  );
}

export function App() {
  const init = useStore((s) => s.init);
  const status = useStore((s) => s.status);
  const progress = useStore((s) => s.progress);
  const error = useStore((s) => s.error);
  const newSession = useStore((s) => s.newSession);

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

        {status === 'ready' && <Dashboard />}

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
