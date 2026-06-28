/**
 * Phase-1 Data-Quality readout. Proves the privacy + ingestion spine end-to-end:
 * a loaded file is parsed, mapped, normalized, de-duplicated, and its quality is
 * quantified — entirely in-browser. (The richer §8.8 view comes in Phase 2.)
 */
import { useStore } from '../state/store';
import { Bar, Card, Chip, ScoreBadge, SectionTitle, Stat } from './components';
import { num, pct } from './format';

export function DataQualityReadout() {
  const result = useStore((s) => s.result);
  const profile = useStore((s) => s.profile);
  if (!result || !profile) return null;
  const { dq, dedup } = result;

  return (
    <div className="mx-auto grid max-w-6xl gap-5 px-4 py-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Rows in" value={num(dedup.inputRows)} sub={`${num(profile.columns.length)} columns`} />
        <Stat
          label="After de-dup"
          value={num(dedup.outputRows)}
          sub={`${num(dedup.rowsDropped)} merged · ${num(dedup.duplicateGroups)} dup groups`}
        />
        <Stat
          label="Blank / placeholder IDs"
          value={num(dedup.blankIdRows)}
          sub={`${num(dedup.highFrequencyIds)} placeholder code(s)`}
        />
        <Stat label="Broken columns" value={num(dq.broken.length)} sub="excluded from metrics" />
        <div className="card flex flex-col justify-center p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Data-quality score</div>
          <div className="mt-1">
            <ScoreBadge score={dq.score.overall} />
          </div>
        </div>
      </div>

      <Card>
        <SectionTitle hint="transparent formula: 0.5×completeness + 0.3×validity + 0.2×consistency">
          Score breakdown
        </SectionTitle>
        <div className="grid gap-3 md:grid-cols-3">
          {(['completeness', 'validity', 'consistency'] as const).map((k) => (
            <div key={k}>
              <div className="mb-1 flex justify-between text-xs text-slate-500">
                <span className="capitalize">{k}</span>
                <span className="tabular">{dq.score[k]}/100</span>
              </div>
              <Bar value={dq.score[k]} tone={dq.score[k] >= 80 ? 'good' : dq.score[k] >= 60 ? 'warn' : 'critical'} />
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <SectionTitle hint="worst-first">Field completeness</SectionTitle>
          <div className="grid max-h-96 gap-1.5 overflow-y-auto pr-1">
            {dq.completeness.map((c) => (
              <div key={c.role} className="grid grid-cols-12 items-center gap-2">
                <span className="col-span-5 truncate text-xs text-slate-600" title={c.header ?? c.label}>
                  {c.label}
                  {c.broken && <span className="ml-1 text-critical-500">⚠</span>}
                </span>
                <span className="col-span-5">
                  <Bar value={c.pct} tone={c.broken ? 'critical' : c.pct >= 80 ? 'good' : c.pct >= 40 ? 'warn' : 'critical'} />
                </span>
                <span className="tabular col-span-2 text-right text-xs text-slate-500">{pct(c.pct)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle hint="valid · missing · invalid (epoch/out-of-range/junk)">Date health</SectionTitle>
          <div className="grid max-h-96 gap-1.5 overflow-y-auto pr-1">
            {dq.dateHealth.map((d) => {
              const total = d.valid + d.missing + d.invalid || 1;
              return (
                <div key={d.role} className="grid grid-cols-12 items-center gap-2">
                  <span className="col-span-4 truncate text-xs text-slate-600" title={d.header ?? d.label}>
                    {d.label}
                  </span>
                  <span className="col-span-6 flex h-2 overflow-hidden rounded-full bg-slate-100">
                    <span className="bg-good-500" style={{ width: `${(d.valid / total) * 100}%` }} />
                    <span className="bg-slate-300" style={{ width: `${(d.missing / total) * 100}%` }} />
                    <span className="bg-critical-500" style={{ width: `${(d.invalid / total) * 100}%` }} />
                  </span>
                  <span className="tabular col-span-2 text-right text-xs text-slate-500">
                    {num(d.valid)}
                    {d.invalid > 0 && <span className="text-critical-500"> +{num(d.invalid)}!</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <SectionTitle hint="unmapped raw tokens — fix in mapping or at source">
            Controlled-vocabulary violations
          </SectionTitle>
          {dq.vocab.length === 0 ? (
            <p className="text-sm text-slate-400">No vocabulary violations detected. ✓</p>
          ) : (
            <div className="grid gap-3">
              {dq.vocab.map((v) => (
                <div key={v.role}>
                  <div className="mb-1 text-xs font-medium text-slate-600">
                    {v.label}{' '}
                    <span className="text-slate-400">
                      ({num(v.total - v.matched)} of {num(v.total)} unmatched)
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {v.unmatchedTokens.map((t) => (
                      <Chip key={t.token} tone="warn">
                        {t.token} ×{t.count}
                      </Chip>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="grid gap-5">
          <Card>
            <SectionTitle>Broken columns (excluded)</SectionTitle>
            {dq.broken.length === 0 ? (
              <p className="text-sm text-slate-400">None.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {dq.broken.map((b) => (
                  <Chip key={b.role} tone="critical">
                    {b.label} · {pct(b.filledPct, 1)}
                  </Chip>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <SectionTitle hint="impossible / suspicious sequences">Cross-field consistency</SectionTitle>
            {dq.consistency.length === 0 ? (
              <p className="text-sm text-slate-400">No sequence anomalies detected. ✓</p>
            ) : (
              <div className="grid gap-1.5">
                {dq.consistency.map((c) => (
                  <div key={c.key} className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">{c.label}</span>
                    <Chip tone="critical">{num(c.count)}</Chip>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
