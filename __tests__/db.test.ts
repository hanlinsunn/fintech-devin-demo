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

describe('database seeding', () => {
  it('creates and seeds the database on first access', () => {
    const cases = listCases();
    expect(cases.length).toBeGreaterThanOrEqual(150);
    expect(cases[0].case_number).toMatch(/^KYC-\d+$/);
  });
});

describe('recordAction', () => {
  it.each(CASE_ACTIONS)('writes an audit row and sets the status for %s', (action) => {
    const target = listCases().find((c) => listCaseActions(c.case_number).length === 0)!;
    const result = recordAction({
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
    expect(listCaseActions(target.case_number)).toHaveLength(1);
    expect(getCase(target.case_number)!.status).toBe(ACTION_TO_STATUS[action]);
  });

  it('updates the assigned analyst on reassign', () => {
    const target = listCases().find((c) => c.assigned_analyst !== 'Patrick')!;
    const result = recordAction({
      caseNumber: target.case_number,
      action: 'reassign',
      comment: 'Handing over for a second look',
      analyst: 'Florence',
      assignTo: 'Patrick',
    });
    expect(result.case.assigned_analyst).toBe('Patrick');
    expect(getCase(target.case_number)!.assigned_analyst).toBe('Patrick');
  });

  it('rejects an empty or whitespace-only comment', () => {
    const target = listCases()[0];
    for (const comment of ['', '   ', '\n\t']) {
      expect(() =>
        recordAction({
          caseNumber: target.case_number,
          action: 'approve',
          comment,
          analyst: 'Daniel',
        }),
      ).toThrow(ValidationError);
    }
  });

  it('rejects an oversized comment without writing anything', () => {
    const target = listCases()[0];
    const before = listCaseActions(target.case_number).length;
    expect(() =>
      recordAction({
        caseNumber: target.case_number,
        action: 'approve',
        comment: 'x'.repeat(MAX_COMMENT_LENGTH + 1),
        analyst: 'Daniel',
      }),
    ).toThrow(/2000 characters or fewer/);
    expect(listCaseActions(target.case_number)).toHaveLength(before);
  });

  it('requires an acting analyst', () => {
    expect(() =>
      recordAction({
        caseNumber: listCases()[0].case_number,
        action: 'approve',
        comment: 'Looks fine',
        analyst: '',
      }),
    ).toThrow(ValidationError);
  });

  it('requires a target analyst for reassign', () => {
    expect(() =>
      recordAction({
        caseNumber: listCases()[0].case_number,
        action: 'reassign',
        comment: 'Reassigning',
        analyst: 'Florence',
      }),
    ).toThrow(/analyst to assign/);
  });

  it('throws CaseNotFoundError for an unknown case', () => {
    expect(() =>
      recordAction({
        caseNumber: 'KYC-DOES-NOT-EXIST',
        action: 'approve',
        comment: 'Nothing to approve',
        analyst: 'Florence',
      }),
    ).toThrow(CaseNotFoundError);
  });
});

describe('audit integrity', () => {
  it('appends rows without mutating earlier ones', () => {
    const target = listCases().find((c) => listCaseActions(c.case_number).length === 0)!;
    const first = recordAction({
      caseNumber: target.case_number,
      action: 'request_docs',
      comment: 'Need a current utility bill',
      analyst: 'Florence',
    }).action;
    const second = recordAction({
      caseNumber: target.case_number,
      action: 'escalate',
      comment: 'Escalating to the AML team',
      analyst: 'Patrick',
    }).action;
    const third = recordAction({
      caseNumber: target.case_number,
      action: 'approve',
      comment: 'Documents received and verified',
      analyst: 'Daniel',
    }).action;

    const log = listCaseActions(target.case_number);
    expect(log).toHaveLength(3);
    expect(log.map((a) => a.action)).toEqual(['request_docs', 'escalate', 'approve']);
    expect(log[0]).toEqual(first);
    expect(log[1]).toEqual(second);
    expect(log[2]).toEqual(third);
    expect(getCase(target.case_number)!.status).toBe('approved');
  });
});

describe('persistence', () => {
  it('reads a status change back after the connection is reopened', () => {
    const target = listCases().find((c) => c.status !== 'rejected')!;
    recordAction({
      caseNumber: target.case_number,
      action: 'reject',
      comment: 'Fabricated documents',
      analyst: 'Florence',
    });

    // Simulates a server restart: drop the connection and read from the file again.
    closeDb();

    expect(getCase(target.case_number)!.status).toBe('rejected');
    expect(listCaseActions(target.case_number).at(-1)).toMatchObject({
      action: 'reject',
      comment: 'Fabricated documents',
    });
  });
});
