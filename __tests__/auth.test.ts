import { ANALYST_ROLES, NOT_AUTHORIZED_MESSAGE, canActOnCase, isAnalyst } from '@/lib/auth';
import { makeCase } from './helpers/fixtures';

describe('isAnalyst', () => {
  it('accepts only the three known analysts', () => {
    expect(isAnalyst('Florence')).toBe(true);
    expect(isAnalyst('Patrick')).toBe(true);
    expect(isAnalyst('Daniel')).toBe(true);
    expect(isAnalyst('Mallory')).toBe(false);
    expect(isAnalyst(undefined)).toBe(false);
    expect(isAnalyst(null)).toBe(false);
  });
});

describe('ANALYST_ROLES', () => {
  it('marks Florence as the senior analyst', () => {
    expect(ANALYST_ROLES).toEqual({
      Florence: 'senior analyst',
      Patrick: 'analyst',
      Daniel: 'analyst',
    });
  });
});

describe('canActOnCase', () => {
  const florenceCase = makeCase({ assigned_analyst: 'Florence' });

  it('allows the assigned analyst', () => {
    expect(canActOnCase(florenceCase, 'Florence')).toBe(true);
  });

  it('blocks every other analyst, including the senior analyst on someone else’s case', () => {
    expect(canActOnCase(florenceCase, 'Daniel')).toBe(false);
    expect(canActOnCase(makeCase({ assigned_analyst: 'Daniel' }), 'Florence')).toBe(false);
  });

  it('blocks unknown or missing identities', () => {
    expect(canActOnCase(florenceCase, null)).toBe(false);
    expect(canActOnCase(florenceCase, 'Mallory')).toBe(false);
  });

  it('exposes the message the UI and API share', () => {
    expect(NOT_AUTHORIZED_MESSAGE).toBe('Not authorized to take this action');
  });
});
