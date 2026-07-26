import { ageInDays, formatAge, maskSsn } from '@/lib/domain';
import { daysAgo } from './helpers/fixtures';

describe('maskSsn', () => {
  it('shows only the last four digits', () => {
    expect(maskSsn('412-88-7391')).toBe('***-**-7391');
    expect(maskSsn('412887391')).toBe('***-**-7391');
  });
});

describe('age of request', () => {
  it('computes whole days since the case was created', () => {
    expect(ageInDays(daysAgo(0))).toBe(0);
    expect(ageInDays(daysAgo(1))).toBe(1);
    expect(ageInDays(daysAgo(17))).toBe(17);
  });

  it('never reports a negative age for future timestamps', () => {
    expect(ageInDays(daysAgo(-3))).toBe(0);
  });

  it('formats the age for display', () => {
    expect(formatAge(daysAgo(0))).toBe('today');
    expect(formatAge(daysAgo(1))).toBe('1 day');
    expect(formatAge(daysAgo(9))).toBe('9 days');
  });
});
