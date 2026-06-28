/** Persistent top bar: AM/NS brand identity + local-only privacy controls. */
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
    <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300" title={title}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-4.5 w-8 rounded-full transition-colors ${checked ? 'bg-brand-500' : 'bg-slate-600'}`}
        style={{ height: '18px', width: '32px' }}
      >
        <span
          className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-3.5' : 'translate-x-0.5'
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
    <header className="no-print sticky top-0 z-10" style={{ background: '#000' }}>
      <div className="mx-auto flex max-w-6xl items-stretch justify-between gap-3 px-4">
        {/* Brand identity */}
        <div className="amns-stroke flex items-center gap-3 py-2.5 pr-10">
          <div>
            <div className="text-sm font-bold uppercase tracking-widest text-white">
              TA Command Centre
            </div>
            <div className="text-[9px] font-medium uppercase tracking-[0.18em] text-slate-400">
              ArcelorMittal Nippon Steel India
            </div>
          </div>
          {isDemo && <Chip tone="demo">DEMO</Chip>}
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4 py-2.5">
          <Chip tone="good" >offline</Chip>
          <Toggle
            label="Private drill-down"
            title="Reveal PII locally. Off = people & free-text masked everywhere."
            checked={prefs.privateDrillDown}
            onChange={(v) => void setPref('privateDrillDown', v)}
          />
          <Toggle
            label="Session-only"
            title="Memory-only: nothing persisted; discarded on tab close."
            checked={prefs.sessionOnly}
            onChange={(v) => void setPref('sessionOnly', v)}
          />
          {status === 'ready' && (
            <button
              type="button"
              className="rounded px-2.5 py-1 text-xs font-semibold tracking-wide text-white transition-colors hover:bg-white/10"
              style={{ border: '1px solid rgba(255,255,255,0.25)' }}
              onClick={() => setPresenting(true)}
            >
              ▶ Present
            </button>
          )}
          {status !== 'idle' && (
            <button
              type="button"
              className="rounded px-2.5 py-1 text-xs font-semibold tracking-wide text-white transition-colors hover:bg-white/10"
              style={{ border: '1px solid rgba(255,255,255,0.25)' }}
              onClick={newSession}
            >
              Load new file
            </button>
          )}
          {confirming ? (
            <span className="flex items-center gap-2 text-xs">
              <span className="text-brand-400">Wipe all in-browser data?</span>
              <button
                type="button"
                className="rounded bg-brand-500 px-2 py-1 text-xs font-semibold text-white hover:bg-brand-600"
                onClick={() => {
                  setConfirming(false);
                  void clearAll();
                }}
              >
                Yes, clear
              </button>
              <button
                type="button"
                className="rounded px-2 py-1 text-xs font-semibold text-slate-300 hover:text-white"
                onClick={() => setConfirming(false)}
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              className="rounded px-2.5 py-1 text-xs font-semibold text-brand-400 transition-colors hover:bg-brand-500 hover:text-white"
              style={{ border: '1px solid #e52726' }}
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
