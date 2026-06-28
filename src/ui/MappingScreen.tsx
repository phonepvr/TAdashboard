/**
 * One-time Mapping Screen (§4.2): confirm/adjust which header fills each logical
 * role, order the discovered funnel stages, and bind raw category values to
 * canonical buckets. All choices persist locally (no values in code).
 */
import { useMemo } from 'react';
import { useStore } from '../state/store';
import {
  CANONICAL_RULES,
  GROUP_LABELS,
  GROUP_ORDER,
  ROLES,
} from '../domain/schema';
import { matchFunnelConcept, unmappedHeaders } from '../domain/mapping';
import { canonicalizeCategory } from '../domain/normalize';
import { Card, Chip, SectionTitle } from './components';

export function MappingScreen() {
  const profile = useStore((s) => s.profile);
  const mapping = useStore((s) => s.mapping);
  const setRoleHeader = useStore((s) => s.setRoleHeader);
  const confirmMapping = useStore((s) => s.confirmMapping);

  const unmapped = useMemo(
    () => (profile && mapping ? unmappedHeaders(profile.headers, mapping) : []),
    [profile, mapping],
  );

  if (!profile || !mapping) return null;

  const mappedCount = Object.values(mapping.roleToHeader).filter(Boolean).length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Map your columns</h1>
          <p className="mt-1 text-sm text-slate-500">
            {mappedCount} of {ROLES.length} roles mapped · {profile.rowCount.toLocaleString()} rows ·{' '}
            {unmapped.length} unmapped header{unmapped.length === 1 ? '' : 's'}
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => void confirmMapping()}>
          Confirm &amp; analyze →
        </button>
      </div>

      {unmapped.length > 0 && (
        <Card className="mb-5 border-warn-500/40 bg-warn-50">
          <div className="text-sm text-warn-600">
            <strong>{unmapped.length} header(s)</strong> are not mapped to any role (shown so new
            columns are never silently dropped). Assign them below if relevant.
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {unmapped.map((h) => (
              <Chip key={h} tone="warn">
                {h}
              </Chip>
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-5">
        {GROUP_ORDER.map((group) => {
          const roles = ROLES.filter((r) => r.group === group);
          return (
            <Card key={group}>
              <SectionTitle>{GROUP_LABELS[group]}</SectionTitle>
              <div className="grid gap-2">
                {roles.map((def) => (
                  <div key={def.key} className="grid grid-cols-12 items-center gap-2">
                    <div className="col-span-5 flex items-center gap-2">
                      <span className="text-sm text-slate-700">{def.label}</span>
                      {def.sensitive && <Chip tone="critical">PII</Chip>}
                      {def.canonical && <Chip tone="brand">canonical</Chip>}
                    </div>
                    <div className="col-span-7">
                      <select
                        aria-label={`Header for ${def.label}`}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
                        value={mapping.roleToHeader[def.key] ?? ''}
                        onChange={(e) => setRoleHeader(def.key, e.target.value || null)}
                      >
                        <option value="">— unmapped —</option>
                        {profile.headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      <StageOrderEditor />
      <CanonicalBinding />

      <div className="mt-6 flex justify-end">
        <button type="button" className="btn-primary" onClick={() => void confirmMapping()}>
          Confirm &amp; analyze →
        </button>
      </div>
    </div>
  );
}

function StageOrderEditor() {
  const mapping = useStore((s) => s.mapping);
  const setStageOrder = useStore((s) => s.setStageOrder);
  const order = mapping?.stageOrder ?? [];
  if (order.length === 0) return null;

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setStageOrder(next);
  };

  return (
    <Card className="mt-5">
      <SectionTitle hint="discovered values — drag the order to match your funnel">
        Funnel stage order
      </SectionTitle>
      <ol className="grid gap-1.5">
        {order.map((value, i) => {
          const concept = matchFunnelConcept(value);
          return (
            <li key={value} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-1.5">
              <span className="flex items-center gap-2 text-sm text-slate-700">
                <span className="tabular w-5 text-slate-400">{i + 1}</span>
                {value}
                {concept && <Chip tone="neutral">{concept.label}</Chip>}
              </span>
              <span className="flex gap-1">
                <button type="button" aria-label="Move up" className="btn-ghost px-2 py-1" onClick={() => move(i, -1)}>
                  ↑
                </button>
                <button type="button" aria-label="Move down" className="btn-ghost px-2 py-1" onClick={() => move(i, 1)}>
                  ↓
                </button>
              </span>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

function CanonicalBinding() {
  const profile = useStore((s) => s.profile);
  const mapping = useStore((s) => s.mapping);
  const setValueOverride = useStore((s) => s.setValueOverride);
  if (!profile || !mapping) return null;

  const roles = ROLES.filter((r) => r.canonical && mapping.roleToHeader[r.key]);
  if (roles.length === 0) return null;

  return (
    <Card className="mt-5">
      <SectionTitle hint="the app proposes; you can override">Canonical value mapping</SectionTitle>
      <div className="grid gap-4 md:grid-cols-2">
        {roles.map((def) => {
          const header = mapping.roleToHeader[def.key]!;
          const col = profile.columns.find((c) => c.header === header);
          const values = col?.sampleValues ?? [];
          const buckets = CANONICAL_RULES[def.canonical!].buckets;
          if (values.length === 0) return null;
          return (
            <div key={def.key} className="rounded-lg border border-slate-200 p-3">
              <div className="mb-2 text-sm font-medium text-slate-700">{def.label}</div>
              <div className="grid gap-1.5">
                {values.slice(0, 20).map((v) => {
                  const proposed = canonicalizeCategory(def.key, v, mapping.valueOverrides[def.key]).value;
                  return (
                    <div key={v} className="grid grid-cols-2 items-center gap-2 text-xs">
                      <span className="truncate text-slate-500" title={v}>
                        {v}
                      </span>
                      <select
                        aria-label={`Canonical bucket for ${v}`}
                        className="rounded border border-slate-300 bg-white px-2 py-1"
                        value={proposed ?? ''}
                        onChange={(e) => setValueOverride(def.key, v, e.target.value)}
                      >
                        {buckets.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
