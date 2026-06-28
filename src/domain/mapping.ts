/**
 * Schema-mapping engine: fuzzy-match the file's HEADER NAMES to logical roles,
 * and suggest a canonical funnel order from discovered `stage` values.
 *
 * Operates purely on header strings + the GENERIC concept ladder — it never
 * inspects or hard-codes data values.
 */
import { FUNNEL_CONCEPTS, ROLES, type FunnelConcept } from './schema';
import type { LogicalRole, MappingConfig } from './types';

export const MAPPING_VERSION = 1;

function normHdr(s: string): string {
  return s
    .replace(/ /g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenSet(s: string): Set<string> {
  return new Set(normHdr(s).split(' ').filter(Boolean));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

/** Similarity in [0,1] between an actual header and a candidate header name. */
export function headerSimilarity(header: string, candidate: string): number {
  const h = normHdr(header);
  const c = normHdr(candidate);
  if (!h || !c) return 0;
  if (h === c) return 1;
  if (h.replace(/ /g, '') === c.replace(/ /g, '')) return 0.97;
  if (h.includes(c) || c.includes(h)) return 0.86;
  return jaccard(tokenSet(header), tokenSet(candidate)) * 0.8;
}

/** Best similarity of an actual header against any of a role's default candidates. */
function roleScore(header: string, role: LogicalRole): number {
  const def = ROLES.find((r) => r.key === role);
  if (!def) return 0;
  let best = 0;
  for (const cand of def.defaultHeaders) {
    const s = headerSimilarity(header, cand);
    if (s > best) best = s;
  }
  return best;
}

const MATCH_THRESHOLD = 0.6;

/**
 * Greedy 1:1 assignment of headers to roles by best score. Each header maps to
 * at most one role and vice-versa; ties resolve to the higher score.
 */
export function autoMapHeaders(headers: string[]): Partial<Record<LogicalRole, string | null>> {
  const candidates: { role: LogicalRole; header: string; score: number }[] = [];
  for (const def of ROLES) {
    for (const header of headers) {
      const score = roleScore(header, def.key);
      if (score >= MATCH_THRESHOLD) candidates.push({ role: def.key, header, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score);

  const usedRoles = new Set<LogicalRole>();
  const usedHeaders = new Set<string>();
  const out: Partial<Record<LogicalRole, string | null>> = {};
  for (const c of candidates) {
    if (usedRoles.has(c.role) || usedHeaders.has(c.header)) continue;
    out[c.role] = c.header;
    usedRoles.add(c.role);
    usedHeaders.add(c.header);
  }
  return out;
}

export function buildDefaultMapping(headers: string[], now: number): MappingConfig {
  return {
    version: MAPPING_VERSION,
    roleToHeader: autoMapHeaders(headers),
    valueOverrides: {},
    updatedAt: now,
  };
}

/** Headers in the file that didn't map to any role (surfaced as "unmapped"). */
export function unmappedHeaders(
  headers: string[],
  mapping: MappingConfig,
): string[] {
  const used = new Set(Object.values(mapping.roleToHeader).filter(Boolean) as string[]);
  return headers.filter((h) => !used.has(h));
}

// ───────────────────────── Funnel concept matching ─────────────────────────

export function matchFunnelConcept(value: string): FunnelConcept | null {
  const v = normHdr(value);
  if (!v) return null;
  let best: { concept: FunnelConcept; score: number } | null = null;
  for (const concept of FUNNEL_CONCEPTS) {
    for (const kw of concept.keywords) {
      if (v.includes(kw)) {
        // longer keyword hit = stronger signal
        const score = kw.length;
        if (!best || score > best.score) best = { concept, score };
      }
    }
  }
  return best?.concept ?? null;
}

/**
 * Order discovered stage values along the canonical funnel ladder. Off-pipeline
 * (hold/dropped) and unrecognised values are pushed to the end. The user can
 * reorder in the Mapping Screen; this is only a suggestion.
 */
export function suggestStageOrder(distinctStageValues: string[]): string[] {
  return [...distinctStageValues]
    .map((value) => ({ value, concept: matchFunnelConcept(value) }))
    .sort((a, b) => {
      const ao = a.concept?.order ?? 999;
      const bo = b.concept?.order ?? 999;
      if (ao !== bo) return ao - bo;
      return a.value.localeCompare(b.value);
    })
    .map((x) => x.value);
}
