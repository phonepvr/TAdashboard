/** Global filter bar — drives every metrics view. PII option labels are masked. */
import { useMemo } from 'react';
import { useStore } from '../state/store';
import type { SlicerFilterKey } from '../state/store';
import { slicerOptions } from '../domain/metrics';
import { ROLE_BY_KEY } from '../domain/schema';
import { maskValue } from './mask';

const SLICERS: { key: SlicerFilterKey; label: string }[] = [
  { key: 'calendarYear', label: 'Period' },
  { key: 'businessUnit', label: 'BU' },
  { key: 'function', label: 'Function' },
  { key: 'hrHead', label: 'HR Head' },
  { key: 'level', label: 'Level' },
  { key: 'recruiter', label: 'Recruiter' },
  { key: 'source', label: 'Source' },
  { key: 'demandType', label: 'Demand' },
];

function MultiSelect({
  label,
  options,
  selected,
  sensitive,
  reveal,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  sensitive: boolean;
  reveal: boolean;
  onChange: (values: string[]) => void;
}) {
  if (options.length === 0) return null;
  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50">
        {label}
        {selected.length > 0 && (
          <span className="rounded-full bg-brand-600 px-1.5 text-[10px] font-semibold text-white">
            {selected.length}
          </span>
        )}
        <span className="text-slate-400">▾</span>
      </summary>
      <div className="absolute z-20 mt-1 max-h-72 w-56 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
        {selected.length > 0 && (
          <button
            type="button"
            className="mb-1 w-full rounded px-2 py-1 text-left text-xs text-brand-700 hover:bg-brand-50"
            onClick={() => onChange([])}
          >
            Clear {label}
          </button>
        )}
        {options.map((opt) => (
          <label key={opt} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-slate-50">
            <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} />
            <span className="truncate" title={maskValue(opt, sensitive, reveal)}>
              {maskValue(opt, sensitive, reveal)}
            </span>
          </label>
        ))}
      </div>
    </details>
  );
}

export function FilterBar() {
  const result = useStore((s) => s.result);
  const filters = useStore((s) => s.filters);
  const setFilter = useStore((s) => s.setFilter);
  const clearFilters = useStore((s) => s.clearFilters);
  const reveal = useStore((s) => s.prefs.privateDrillDown);

  const options = useMemo(() => (result ? slicerOptions(result.rows) : {}), [result]);
  if (!result) return null;
  const anyActive = Object.keys(filters).length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Filter</span>
      {SLICERS.map((s) => (
        <MultiSelect
          key={s.key}
          label={s.label}
          options={options[s.key] ?? []}
          selected={(filters[s.key] as string[] | undefined) ?? []}
          sensitive={ROLE_BY_KEY[s.key].sensitive}
          reveal={reveal}
          onChange={(v) => setFilter(s.key, v)}
        />
      ))}
      {anyActive && (
        <button type="button" className="ml-auto text-xs text-brand-700 hover:underline" onClick={clearFilters}>
          Clear all filters
        </button>
      )}
    </div>
  );
}
