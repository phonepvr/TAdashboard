/**
 * §8.2 HR-Head / BU / Function Review (meeting mode). Pick an HR Head → their
 * scope side-by-side with the org baseline on every KPI, per-BU/function
 * scorecards, scoped aged-open + TBO worklists, drop analysis, and a print
 * one-pager. PII masked unless private drill-down; the head's own name is
 * aliased ("HR Head A/B…") in shared views.
 */
import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import {
  agedOpenWorklist,
  byGroupScorecards,
  distinctValues,
  dropAnalysis,
  reviewComparison,
  tboWorklist,
  type GroupScorecard,
  type KpiCompare,
} from '../domain/metrics';
import { formatISO } from '../domain/dates';
import { Card, Chip, SectionTitle } from './components';
import { ExportBar } from './ExportBar';
import { FORMULAS } from './definitions';
import { num, pct } from './format';
import { buildAliasMap, maskValue } from './mask';

const fmtCmp = (v: number | null, unit: KpiCompare['unit']) =>
  v === null ? '—' : unit === 'days' ? `${num(v)}d` : pct(v * 100);

function variance(c: KpiCompare): { tone: string; label: string } {
  if (c.scope === null || c.baseline === null) return { tone: 'text-slate-400', label: '' };
  const diff = c.scope - c.baseline;
  if (Math.abs(diff) < 1e-9) return { tone: 'text-slate-400', label: '0' };
  const worse = c.direction === 'lowerBetter' ? diff > 0 : c.direction === 'higherBetter' ? diff < 0 : false;
  const tone = c.direction === 'neutral' ? 'text-slate-500' : worse ? 'text-critical-600' : 'text-good-600';
  const d = c.unit === 'days' ? `${diff > 0 ? '+' : ''}${num(diff)}d` : `${diff > 0 ? '+' : ''}${pct(diff * 100)}`;
  return { tone, label: d };
}

export function ReviewMode() {
  const result = useStore((s) => s.result);
  const reveal = useStore((s) => s.prefs.privateDrillDown);

  const heads = useMemo(() => (result ? distinctValues(result.rows, 'hrHead') : []), [result]);
  const aliasMap = useMemo(() => buildAliasMap(heads, 'HR Head'), [heads]);
  const [head, setHead] = useState<string>('');
  const selected = head || heads[0] || '';

  const scope = useMemo(
    () => (result ? result.rows.filter((r) => r.cat.hrHead === selected) : []),
    [result, selected],
  );

  if (!result) return null;
  if (heads.length === 0) return <div className="px-4 py-16 text-center text-sm text-slate-400">No HR Head field mapped.</div>;

  const label = (v: string) => (reveal ? v : aliasMap.get(v) ?? v);
  const cmp = reviewComparison(scope, result.rows);
  const drops = dropAnalysis(scope);

  return (
    <div className="mx-auto grid max-w-6xl gap-5 px-4 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          HR Head
          <select value={selected} onChange={(e) => setHead(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm">
            {heads.map((h) => (
              <option key={h} value={h}>{label(h)}</option>
            ))}
          </select>
        </label>
        <ExportBar targetId="review-onepager" baseName="hr-head-one-pager" />
      </div>

      <div id="review-onepager" className="grid gap-5">
        <div className="flex items-baseline justify-between">
          <h1 className="text-lg font-semibold text-slate-900">{label(selected)} — review</h1>
          <span className="text-xs text-slate-400">{num(scope.length)} reqs · scope vs org baseline</span>
        </div>

        {/* Scope vs baseline */}
        <Card>
          <SectionTitle hint="their median vs org median — variance highlighted" info={FORMULAS.reviewScorecard}>Scorecard vs baseline</SectionTitle>
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-400">
              <tr>
                <th className="text-left font-medium">KPI</th>
                <th className="text-right font-medium">This head</th>
                <th className="text-right font-medium">Org baseline</th>
                <th className="text-right font-medium">Variance</th>
              </tr>
            </thead>
            <tbody>
              {cmp.map((c) => {
                const v = variance(c);
                return (
                  <tr key={c.key} className="border-t border-slate-100">
                    <td className="py-1.5 text-slate-700">{c.label}</td>
                    <td className="tabular py-1.5 text-right font-medium text-slate-900">{fmtCmp(c.scope, c.unit)}</td>
                    <td className="tabular py-1.5 text-right text-slate-500">{fmtCmp(c.baseline, c.unit)}</td>
                    <td className={`tabular py-1.5 text-right ${v.tone}`}>{v.label}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        {/* Per-BU & per-Function scorecards */}
        <div className="grid gap-5 lg:grid-cols-2">
          <ScorecardTable title="Per Business Unit" rows={byGroupScorecards(scope, 'businessUnit')} info={FORMULAS.groupScorecard} />
          <ScorecardTable title="Per Function" rows={byGroupScorecards(scope, 'function')} info={FORMULAS.groupScorecard} />
        </div>

        {/* Worklists */}
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <SectionTitle hint="open > 90d, oldest first — walk these in the review" info={FORMULAS.reviewAgedWorklist}>Aged-open worklist</SectionTitle>
            <Worklist
              cols={['Req', 'BU', 'Function', 'Stage', 'Age']}
              rows={agedOpenWorklist(scope, 90).slice(0, 15).map((a) => [
                a.reqId ?? `#${a.i}`,
                a.businessUnit ?? '—',
                a.function ?? '—',
                a.stage ?? '—',
                `${num(a.ageDays)}d`,
              ])}
              emptyMsg="No open reqs over 90 days. ✓"
            />
          </Card>
          <Card>
            <SectionTitle hint="offer accepted, awaiting join" info={FORMULAS.reviewTbo}>TBO worklist</SectionTitle>
            <Worklist
              cols={['Req', 'BU', 'TBO age', 'Next follow-up', 'Recruiter']}
              rows={tboWorklist(scope).slice(0, 15).map((t) => [
                t.reqId ?? `#${t.i}`,
                t.businessUnit ?? '—',
                t.tboAgeingDays !== null ? `${num(t.tboAgeingDays)}d` : '—',
                t.nextFollowUp !== null ? formatISO(t.nextFollowUp) : '—',
                maskValue(t.recruiter, true, reveal),
              ])}
              emptyMsg="No TBO in this scope. ✓"
            />
          </Card>
        </div>

        {/* Drop analysis */}
        <Card>
          <SectionTitle hint="counts + masked reasons (names stripped)" info={FORMULAS.dropAnalysis}>Drop analysis</SectionTitle>
          <div className="mb-2 text-sm text-slate-600">
            <strong>{num(drops.count)}</strong> drop(s) · {pct(drops.rate * 100)} of scope
          </div>
          {drops.reasons.length === 0 ? (
            <p className="text-xs text-slate-400">No drop reasons recorded.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {drops.reasons.slice(0, 12).map((r) => (
                <Chip key={r.key} tone="neutral">{r.key} ×{r.count}</Chip>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function ScorecardTable({ title, rows, info }: { title: string; rows: GroupScorecard[]; info?: string }) {
  return (
    <Card>
      <SectionTitle info={info}>{title}</SectionTitle>
      {rows.length === 0 ? (
        <p className="text-xs text-slate-400">No data.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-slate-400">
              <tr>
                <th className="text-left font-medium">Group</th>
                <th className="text-right font-medium">Reqs</th>
                <th className="text-right font-medium">TTF</th>
                <th className="text-right font-medium">Accept</th>
                <th className="text-right font-medium">&gt;180d</th>
                <th className="text-right font-medium">Drop</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 10).map((g) => (
                <tr key={g.group} className="border-t border-slate-100">
                  <td className="py-1 text-slate-700">{g.group}</td>
                  <td className="tabular py-1 text-right text-slate-600">{num(g.n)}</td>
                  <td className="tabular py-1 text-right text-slate-600">{g.medianTtf !== null ? `${num(g.medianTtf)}d` : '—'}</td>
                  <td className="tabular py-1 text-right text-slate-600">{pct(g.acceptance * 100)}</td>
                  <td className="tabular py-1 text-right text-slate-600">{pct(g.pctAged180 * 100)}</td>
                  <td className="tabular py-1 text-right text-slate-600">{pct(g.dropRate * 100)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function Worklist({ cols, rows, emptyMsg }: { cols: string[]; rows: string[][]; emptyMsg: string }) {
  if (rows.length === 0) return <p className="text-xs text-slate-400">{emptyMsg}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-slate-400">
          <tr>{cols.map((c) => <th key={c} className="text-left font-medium">{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-slate-100">
              {r.map((cell, j) => (
                <td key={j} className={`py-1 ${j === r.length - 1 && cols[j] === 'Age' ? 'text-right text-critical-600' : 'text-slate-600'}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
