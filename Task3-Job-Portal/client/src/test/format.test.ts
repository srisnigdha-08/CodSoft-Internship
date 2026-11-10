import { describe, expect, it } from 'vitest';
import {
  deadlineToDateInput,
  deadlineToIso,
  formatFileSize,
  formatSalary,
  toDateInput,
} from '../lib/format';

describe('format helpers', () => {
  it('formats salary ranges', () => {
    expect(formatSalary(null, null)).toBe('Not disclosed');
    expect(formatSalary(100000, 200000)).toContain('1,00,000');
    expect(formatSalary(100000, null)).toMatch(/^From/);
    expect(formatSalary(null, 200000)).toMatch(/^Up to/);
  });

  it('formats file sizes', () => {
    expect(formatFileSize(500)).toBe('500 B');
    expect(formatFileSize(2048)).toBe('2 KB');
    expect(formatFileSize(1572864)).toBe('1.5 MB');
  });

  it('round-trips a deadline through its date input value', () => {
    const iso = deadlineToIso('2030-03-15');
    expect(iso).not.toBeNull();
    expect(deadlineToDateInput(iso)).toBe('2030-03-15');
    expect(deadlineToIso('')).toBeNull();
  });

  it('reads stored calendar dates without shifting them', () => {
    expect(toDateInput('2021-05-30T00:00:00.000Z')).toBe('2021-05-30');
    expect(toDateInput(null)).toBe('');
  });
});
