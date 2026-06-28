/** Persistent top bar: identity, demo badge, and the local-only privacy controls. */
import { useState } from 'react';
import { useStore } from '../state/store';
import { Chip } from './components';

function Toggle({
  checked,
  onChange,
  label,
  title,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  title?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600" title={title}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 rounded-full transition-colors ${checked ? 'bg-brand-600' : 'bg-slate-300'}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </button>
      {label}
    </label>
  );
}

export function TopBar() {
  const status = useStore((s) => s.status);
  const isDemo = useStore((s) => s.isDemo);
  const prefs = useStore((s) => s.prefs);
  const setPref = useStore((s) => s.setPref);
  const clearAll = useStore((s) => s.clearAll);
  const newSession = useStore((s) => s.newSession);
  const setPresenting = useStore((s) => s.setPresenting);
  const [confirming, setConfirming] = useState(false);

  return (
    <header className="no-print sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-900">TA Command Centre</span>
          <Chip tone="good" >offline</Chip>
          {isDemo && <Chip tone="demo">DEMO DATA</Chip>}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Toggle
            label="Private drill-down"
            title="Reveal PII locally. Off = people & free-text masked everywhere."
            checked={prefs.privateDrillDown}
            onChange={(v) => void setPref('privateDrillDown', v)}
          />
          <Toggle
            label="Session-only"
            title="Memory-only: nothing is persisted; discarded on tab close."
            checked={prefs.sessionOnly}
            onChange={(v) => void setPref('sessionOnly', v)}
          />
          {status === 'ready' && (
            <button type="button" className="btn-ghost px-2.5 py-1 text-xs" onClick={() => setPresenting(true)}>
              ▶ Present
            </button>
          )}
          {status !== 'idle' && (
            <button type="button" className="btn-ghost px-2.5 py-1 text-xs" onClick={newSession}>
              Load new file
            </button>
          )}
          {confirming ? (
            <span className="flex items-center gap-2 text-xs">
              <span className="text-critical-600">Wipe all in-browser data?</span>
              <button
                type="button"
                className="btn-danger px-2 py-1 text-xs"
                onClick={() => {
                  setConfirming(false);
                  void clearAll();
                }}
              >
                Yes, clear
              </button>
              <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              className="btn-danger px-2.5 py-1 text-xs"
              onClick={() => setConfirming(true)}
            >
              Clear all data
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
