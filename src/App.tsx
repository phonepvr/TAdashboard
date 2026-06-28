import { useEffect } from 'react';
import { useStore } from './state/store';
import { TopBar } from './ui/TopBar';
import { FileLoader } from './ui/FileLoader';
import { MappingScreen } from './ui/MappingScreen';
import { DataQualityReadout } from './ui/DataQualityReadout';
import { ProgressBar } from './ui/components';

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

        {status === 'ready' && <DataQualityReadout />}

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
