/** Reusable export controls: PDF (print) + PNG, with a per-export PII opt-in. */
import { useState } from 'react';
import { useStore } from '../state/store';
import { captureElementToPng, nextPaint, printDocument } from './export';

export function ExportBar({ targetId, baseName }: { targetId: string; baseName: string }) {
  const reveal = useStore((s) => s.prefs.privateDrillDown);
  const setPref = useStore((s) => s.setPref);
  const [includePii, setIncludePii] = useState(false);
  const [busy, setBusy] = useState(false);

  // Temporarily reveal PII for this export only, then restore.
  const withReveal = async (fn: () => Promise<void> | void) => {
    const needToggle = includePii && !reveal;
    if (needToggle) {
      await setPref('privateDrillDown', true);
      await nextPaint();
    }
    try {
      await fn();
    } finally {
      if (needToggle) await setPref('privateDrillDown', false);
    }
  };

  const exportPng = async () => {
    setBusy(true);
    try {
      await withReveal(async () => {
        const el = document.getElementById(targetId);
        if (el) await captureElementToPng(el, `${baseName}.png`);
      });
    } finally {
      setBusy(false);
    }
  };

  const exportPdf = async () => {
    await withReveal(async () => {
      await nextPaint();
      printDocument();
    });
  };

  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-1.5 text-xs text-slate-500" title="Include unmasked people/free-text in this export only">
        <input type="checkbox" checked={includePii} onChange={(e) => setIncludePii(e.target.checked)} />
        Include unmasked PII
      </label>
      <button type="button" className="btn-ghost px-2.5 py-1 text-xs" onClick={() => void exportPdf()}>
        ⬇ PDF
      </button>
      <button type="button" className="btn-ghost px-2.5 py-1 text-xs disabled:opacity-50" disabled={busy} onClick={() => void exportPng()}>
        {busy ? 'Rendering…' : '⬇ PNG'}
      </button>
    </div>
  );
}
