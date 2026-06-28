import { describe, expect, it } from 'vitest';
import { buildAliasMap, initials, maskValue } from '../ui/mask';

describe('PII masking', () => {
  it('reduces names to initials', () => {
    expect(initials('Priya Sharma')).toBe('P.S.');
  });

  it('builds a stable sorted alias map', () => {
    const m = buildAliasMap(['Bravo', 'Alfa', 'Bravo'], 'HR Head');
    expect(m.get('Alfa')).toBe('HR Head A');
    expect(m.get('Bravo')).toBe('HR Head B');
  });

  it('masks sensitive values unless revealed', () => {
    expect(maskValue('Priya Sharma', true, false)).toBe('P.S.');
    expect(maskValue('Priya Sharma', true, true)).toBe('Priya Sharma');
    expect(maskValue('Engineering', false, false)).toBe('Engineering');
    expect(maskValue(null, true, false)).toBe('—');
  });
});
