/** §8.7 Recruiter / RPO productivity. PII masked by default; median TTF n-guarded. */
import { useMemo } from 'react';
import { useStore } from '../state/store';
import { applyFilters, loadDistribution, recruiterProductivity, type RecruiterLoad } from '../domain/metrics';
import type { LogicalRole } from '../domain/types';
import { Card, CsvButton, SectionTitle, Stat } from './components';
import { FORMULAS } from './definitions';
import { downloadCsv, slugify } from './csv';
import { requisitionDrill } from './drill';
import { num } from './format';
import { maskValue } from './mask';

function ProductivityTable({
  rows,
  reveal,
  onPick,
}: {
  rows: RecruiterLoad[];
  reveal: boolean;
  onPick: (name: string) => void;
}) {
  if (rows.length === 0) return <p className="text-xs text-slate-400">No data.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-slate-400">
          <tr>
            <th className="text-left font-medium">Name</th>
            <th className="text-right font-medium">Total</th>
            <th className="text-right font-medium">Open WIP</th>
            <th className="text-right font-medium">Joins</th>
            <th className="text-right font-medium">Median TTF</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 20).map((r) => (
            <tr
              key={r.name}
              onClick={() => onPick(r.name)}
              className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
            >
              <td className="py-1 text-slate-700">{maskValue(r.name, true, reveal)}</td>
              <td className="tabular py-1 text-right text-slate-600">{num(r.total)}</td>
              <td className="tabular py-1 text-right text-slate-600">{num(r.openWip)}</td>
              <td className="tabular py-1 text-right text-slate-600">{num(r.joined)}</td>
              <td className="tabular py-1 text-right text-slate-600">{r.ttf ? `${num(r.ttf.median)}d` : <span className="text-slate-300">n&lt;5</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function csvCols(reveal: boolean) {
  return [
    { header: 'Name', value: (r: RecruiterLoad) => maskValue(r.name, true, reveal) },
    { header: 'Total', value: (r: RecruiterLoad) => r.total },
    { header: 'Open WIP', value: (r: RecruiterLoad) => r.openWip },
    { header: 'Joins', value: (r: RecruiterLoad) => r.joined },
    { header: 'Median TTF', value: (r: RecruiterLoad) => r.ttf?.median ?? '' },
  ];
}

export function RecruiterView() {
  const result = useStore((s) => s.result);
  const filters = useStore((s) => s.filters);
  const reveal = useStore((s) => s.prefs.privateDrillDown);
  const openDrill = useStore((s) => s.openDrill);
  const rows = useMemo(() => (result ? applyFilters(result.rows, filters) : []), [result, filters]);

  const recruiters = useMemo(() => recruiterProductivity(rows, 'recruiter', 5), [rows]);
  const rpo = useMemo(() => recruiterProductivity(rows, 'rpoLead', 5), [rows]);
  const recLoad = useMemo(() => loadDistribution(rows, 'recruiter'), [rows]);
  const rpoLoad = useMemo(() => loadDistribution(rows, 'rpoLead'), [rows]);

  if (!result) return null;
  if (rows.length === 0) return <div className="px-4 py-16 text-center text-sm text-slate-400">No rows match the current filters.</div>;

  // Filename is built from the MASKED name so an export never leaks PII via its filename.
  const pick = (role: LogicalRole, roleLabel: string) => (name: string) =>
    openDrill(
      requisitionDrill(
        `${roleLabel}: ${maskValue(name, true, reveal)}`,
        `${role}-${slugify(maskValue(name, true, reveal))}`,
        rows.filter((r) => (r.cat[role] ?? null) === name),
        reveal,
      ),
    );

  return (
    <div className="mx-auto grid max-w-6xl gap-5 px-4 py-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Recruiters" value={num(recLoad.recruiters)} info={FORMULAS.recruiterCount} />
        <Stat label="Max load" value={num(recLoad.maxLoad)} sub={`median ${num(recLoad.medianLoad)}`} info={FORMULAS.recruiterMaxLoad} />
        <Stat label="RPO leads" value={num(rpoLoad.recruiters)} info={FORMULAS.rpoCount} />
        <Stat label="RPO max load" value={num(rpoLoad.maxLoad)} sub={`median ${num(rpoLoad.medianLoad)}`} info={FORMULAS.rpoMaxLoad} />
      </div>

      <Card>
        <SectionTitle hint="WIP · throughput · median TTF (n≥5) — PII masked" info={FORMULAS.recruiterProductivity}
          action={recruiters.length > 0 ? <CsvButton onClick={() => downloadCsv('recruiter-productivity', recruiters, csvCols(reveal))} /> : undefined}>
          Recruiter productivity
        </SectionTitle>
        <ProductivityTable rows={recruiters} reveal={reveal} onPick={pick('recruiter', 'Recruiter')} />
      </Card>

      <Card>
        <SectionTitle hint="RPO vendor leads" info={FORMULAS.rpoProductivity}
          action={rpo.length > 0 ? <CsvButton onClick={() => downloadCsv('rpo-productivity', rpo, csvCols(reveal))} /> : undefined}>
          RPO lead productivity
        </SectionTitle>
        <ProductivityTable rows={rpo} reveal={reveal} onPick={pick('rpoLead', 'RPO lead')} />
      </Card>
    </div>
  );
}
