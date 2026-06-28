import { describe, expect, it } from 'vitest';
import { autoMapHeaders, matchFunnelConcept, suggestStageOrder } from '../domain/mapping';
import { ROLES } from '../domain/schema';

const HEADERS = ROLES.map((r) => r.defaultHeaders[0]!);

describe('autoMapHeaders', () => {
  it('maps exact headers to their roles', () => {
    const m = autoMapHeaders(HEADERS);
    expect(m.requisitionId).toBe('Position Code');
    expect(m.stage).toBe('Stage');
    expect(m.joiningDate).toBe('Joining date');
    expect(m.hrHead).toBe('HR Head');
  });

  it('handles the TBO Aging spelling and is position-independent', () => {
    const m = autoMapHeaders(['Joining date', 'TBO Aging', 'BU']);
    expect(m.joiningDate).toBe('Joining date');
    expect(m.tboAgeingDays).toBe('TBO Aging');
    expect(m.businessUnit).toBe('BU');
  });

  it('fuzzy-maps reasonable synonyms', () => {
    const m = autoMapHeaders(['Req ID', 'DOJ', 'Recruiter']);
    expect(m.requisitionId).toBe('Req ID');
    expect(m.joiningDate).toBe('DOJ');
    expect(m.recruiter).toBe('Recruiter');
  });

  it('assigns each header to at most one role', () => {
    const m = autoMapHeaders(HEADERS);
    const used = Object.values(m).filter(Boolean);
    expect(new Set(used).size).toBe(used.length);
  });
});

describe('funnel concepts', () => {
  it('classifies stage values to generic concepts', () => {
    expect(matchFunnelConcept('On Hold')?.key).toBe('hold');
    expect(matchFunnelConcept('Joined')?.key).toBe('joined');
    expect(matchFunnelConcept('Sourcing')?.key).toBe('sourcing');
  });

  it('suggests a sensible funnel order', () => {
    const order = suggestStageOrder(['Joined', 'Sourcing', 'Interview', 'Dropped']);
    expect(order.indexOf('Sourcing')).toBeLessThan(order.indexOf('Interview'));
    expect(order.indexOf('Interview')).toBeLessThan(order.indexOf('Joined'));
    expect(order.indexOf('Joined')).toBeLessThan(order.indexOf('Dropped'));
  });
});
