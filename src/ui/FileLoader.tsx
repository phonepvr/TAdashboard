/** Entry screen: load a file (drag/drop or picker) or generate synthetic demo data. */
import { useRef, useState } from 'react';
import { useStore } from '../state/store';

export function FileLoader() {
  const loadFile = useStore((s) => s.loadFile);
  const loadDemo = useStore((s) => s.loadDemo);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const onFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) void loadFile(file);
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-4 py-12">
      <div className="text-center">
        <h1 className="text-2xl font-bold uppercase tracking-wide text-slate-900">Load your TA extract</h1>
        <p className="mt-2 text-sm text-slate-500">
          Nothing leaves this browser. Parsing, computation and rendering all happen on this device.
        </p>
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-label="Drop a spreadsheet here or click to browse"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          onFiles(e.dataTransfer.files);
        }}
        className={`flex w-full cursor-pointer flex-col items-center justify-center rounded border-2 border-dashed p-12 text-center transition-colors ${
          dragging ? 'border-brand-500 bg-brand-50' : 'border-slate-300 bg-white hover:border-brand-400 hover:bg-slate-50'
        }`}
      >
        <div className="text-base font-semibold text-slate-700">Drop your .xlsx or .csv here</div>
        <div className="mt-1 text-sm text-slate-400">or click to browse</div>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />
      </div>

      <div className="flex items-center gap-3">
        <div className="h-px w-16 bg-slate-200" />
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">or</span>
        <div className="h-px w-16 bg-slate-200" />
      </div>

      <button type="button" className="btn-ghost font-semibold" onClick={() => void loadDemo()}>
        Load synthetic demo data
      </button>

      <div className="mt-4 rounded border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-500">
        <strong className="font-semibold text-slate-700">Privacy:</strong> This is a 100% in-browser tool. There is
        no server, no upload, and no network egress at runtime — it works offline. Your data is held
        only in this tab&apos;s memory unless you explicitly enable local caching. People and free-text
        fields are masked by default.
      </div>
    </div>
  );
}
