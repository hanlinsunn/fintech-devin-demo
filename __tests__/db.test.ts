/**
 * @jest-environment node
 */
import { useTempDb } from './helpers/testDb';

const temp = useTempDb();

// Imported after the db path override so the module picks up the temp file.
import {
  CaseNotFoundError,
  ValidationError,
  closeDb,
  getCase,
  listCaseActions,
  listCases,
  recordAction,
} from '@/lib/db';
import { ACTION_TO_STATUS, CASE_ACTIONS, MAX_COMMENT_LENGTH } from '@/lib/domain';

afterAll(() => {
  closeDb();
  temp.cleanup();
});

/** The first case with no audit history. */
async function untouchedCase() {
  for (const kycCase of await listCases()) {
    if ((await listCaseActions(kycCase.case_number)).length === 0) return kycCase;
  }
  throw new Error('No untouched case left in the seeded queue');
}

describe('database seeding', () => {
  it('creates and seeds the database on first access', async () => {
    const cases = await listCases();
    expect(cases.length).toBeGreaterThanOrEqual(150);
    expect(cases[0].case_number).toMatch(/^KYC-\d+$/);
  });
});

describe('recordAction', () => {
  it.each(CASE_ACTIONS)('writes an audit row and sets the status for %s', async (action) => {
    const target = await untouchedCase();
    const result = await recordAction({
      caseNumber: target.case_number,
      action,
      comment: `Recording ${action}`,
      analyst: 'Florence',
      ...(action === 'reassign' ? { assignTo: 'Daniel' } : {}),
    });

    expect(result.case.status).toBe(ACTION_TO_STATUS[action]);
    expect(result.action).toMatchObject({
      case_number: target.case_number,
      action,
      comment: `Recording ${action}`,
      analyst: 'Florence',
    });
    expect(await listCaseActions(target.case_number)).toHaveLength(1);
    expect((await getCase(target.case_number))!.status).toBe(ACTION_TO_STATUS[action]);
  });

  it('updates the assigned analyst on reassign', async () => {
    const target = (await listCases()).find((c) => c.assigned_analyst !== 'Patrick')!;
    const result = await recordAction({
      caseNumber: target.case_number,
      action: 'reassign',
      comment: 'Handing over for a second look',
      analyst: 'Florence',
      assignTo: 'Patrick',
    });
    expect(result.case.assigned_analyst).toBe('Patrick');
    expect((await getCase(target.case_number))!.assigned_analyst).toBe('Patrick');
  });

  it('rejects an empty or whitespace-only comment', async () => {
    const target = (await listCases())[0];
    for (const comment of ['', '   ', '\n\t']) {
      await expect(
        recordAction({
          caseNumber: target.case_number,
          action: 'approve',
          comment,
          analyst: 'Daniel',
        }),
      ).rejects.toThrow(ValidationError);
    }
  });

  it('rejects an oversized comment without writing anything', async () => {
    const target = (await listCases())[0];
    const before = (await listCaseActions(target.case_number)).length;
    await expect(
      recordAction({
        caseNumber: target.case_number,
        action: 'approve',
        comment: 'x'.repeat(MAX_COMMENT_LENGTH + 1),
        analyst: 'Daniel',
      }),
    ).rejects.toThrow(/2000 characters or fewer/);
    expect(await listCaseActions(target.case_number)).toHaveLength(before);
  });

  it('requires an acting analyst', async () => {
    await expect(
      recordAction({
        caseNumber: (await listCases())[0].case_number,
        action: 'approve',
        comment: 'Looks fine',
        analyst: '',
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('requires a target analyst for reassign', async () => {
    await expect(
      recordAction({
        caseNumber: (await listCases())[0].case_number,
        action: 'reassign',
        comment: 'Reassigning',
        analyst: 'Florence',
      }),
    ).rejects.toThrow(/analyst to assign/);
  });

  it('throws CaseNotFoundError for an unknown case', async () => {
    await expect(
      recordAction({
        caseNumber: 'KYC-DOES-NOT-EXIST',
        action: 'approve',
        comment: 'Nothing to approve',
        analyst: 'Florence',
      }),
    ).rejects.toThrow(CaseNotFoundError);
  });
});

describe('audit integrity', () => {
  it('appends rows without mutating earlier ones', async () => {
    const target = await untouchedCase();
    const first = (
      await recordAction({
        caseNumber: target.case_number,
        action: 'request_docs',
        comment: 'Need a current utility bill',
        analyst: 'Florence',
      })
    ).action;
    const second = (
      await recordAction({
        caseNumber: target.case_number,
        action: 'escalate',
        comment: 'Escalating to the AML team',
        analyst: 'Patrick',
      })
    ).action;
    const third = (
      await recordAction({
        caseNumber: target.case_number,
        action: 'approve',
        comment: 'Documents received and verified',
        analyst: 'Daniel',
      })
    ).action;

    const log = await listCaseActions(target.case_number);
    expect(log).toHaveLength(3);
    expect(log.map((a) => a.action)).toEqual(['request_docs', 'escalate', 'approve']);
    expect(log[0]).toEqual(first);
    expect(log[1]).toEqual(second);
    expect(log[2]).toEqual(third);
    expect((await getCase(target.case_number))!.status).toBe('approved');
  });
});

describe('persistence', () => {
  it('reads a status change back after the connection is reopened', async () => {
    const target = (await listCases()).find((c) => c.status !== 'rejected')!;
    await recordAction({
      caseNumber: target.case_number,
      action: 'reject',
      comment: 'Fabricated documents',
      analyst: 'Florence',
    });

    // Simulates a server restart: drop the connection and read from the file again.
    closeDb();

    expect((await getCase(target.case_number))!.status).toBe('rejected');
    expect((await listCaseActions(target.case_number)).at(-1)).toMatchObject({
      action: 'reject',
      comment: 'Fabricated documents',
    });
  });
});
