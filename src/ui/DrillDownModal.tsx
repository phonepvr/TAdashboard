/**
 * Row-level drill-down overlay. Opened from any clickable number / bar / row via
 * the store's `openDrill`. Shows the underlying rows in a scrollable table and a
 * "Download CSV" action. Everything stays local; the CSV contains exactly what is
 * shown (people fields masked unless Private drill-down is on). Hidden from print.
 */
import { useEffect } from 'react';
import { useStore } from '../state/store';
import { downloadDrill } from './csv';
import { num } from './format';

const DISPLAY_CAP = 300;

export function DrillDownModal() {
  const drill = useStore((s) => s.drill);
  const close = useStore((s) => s.closeDrill);

  useEffect(() => {
    if (!drill) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drill, close]);

  if (!drill) return null;
  const shown = drill.rows.slice(0, DISPLAY_CAP);
  const truncated = drill.rows.length - shown.length;

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={drill.title}
      onClick={close}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-xl bg-white shadow-2xl sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-900">{drill.title}</h2>
            {drill.subtitle && <p className="mt-0.5 text-xs text-slate-500">{drill.subtitle}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => downloadDrill(drill)}
              className="btn-primary px-2.5 py-1 text-xs"
            >
              ↓ CSV ({num(drill.rows.length)})
            </button>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        {drill.rows.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-slate-400">No rows.</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50 text-slate-500">
                <tr>
                  {drill.columns.map((c) => (
                    <th
                      key={c.key}
                      className={`whitespace-nowrap px-2.5 py-2 font-semibold ${c.align === 'right' ? 'text-right' : 'text-left'}`}
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((r, i) => (
                  <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                    {drill.columns.map((c) => (
                      <td
                        key={c.key}
                        className={`whitespace-nowrap px-2.5 py-1.5 ${c.align === 'right' ? 'tabular text-right text-slate-600' : 'text-slate-700'}`}
                      >
                        {r[c.key] === null || r[c.key] === undefined || r[c.key] === '' ? '—' : String(r[c.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-4 py-2 text-[11px] text-slate-400">
          <span>{drill.note}</span>
          {truncated > 0 && <span>Showing first {num(DISPLAY_CAP)} · CSV includes all {num(drill.rows.length)}.</span>}
        </div>
      </div>
    </div>
  );
}
