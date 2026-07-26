/**
 * @jest-environment node
 */
import { useTempDb } from './helpers/testDb';

const temp = useTempDb();

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));

import { POST } from '@/app/api/cases/[caseNumber]/actions/route';
import { GET as getCaseRoute } from '@/app/api/cases/[caseNumber]/route';
import { GET as listCasesRoute } from '@/app/api/cases/route';
import { closeDb, listCaseActions, listCases } from '@/lib/db';
import { MAX_COMMENT_LENGTH } from '@/lib/domain';

afterAll(() => {
  closeDb();
  temp.cleanup();
});

function post(caseNumber: string, body: unknown) {
  const request = new Request(`http://localhost/api/cases/${caseNumber}/actions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return POST(request, { params: { caseNumber } });
}

describe('GET /api/cases', () => {
  it('returns the seeded queue', async () => {
    const response = await listCasesRoute();
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.cases.length).toBeGreaterThanOrEqual(150);
  });
});

describe('GET /api/cases/[caseNumber]', () => {
  it('returns a case with its audit log', async () => {
    const caseNumber = listCases()[0].case_number;
    const response = await getCaseRoute(new Request('http://localhost'), {
      params: { caseNumber },
    });
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.case.case_number).toBe(caseNumber);
    expect(Array.isArray(payload.actions)).toBe(true);
  });

  it('404s for an unknown case', async () => {
    const response = await getCaseRoute(new Request('http://localhost'), {
      params: { caseNumber: 'KYC-NOPE' },
    });
    expect(response.status).toBe(404);
  });
});

describe('POST /api/cases/[caseNumber]/actions', () => {
  it('records the action with the acting analyst from the request', async () => {
    const caseNumber = listCases().find((c) => listCaseActions(c.case_number).length === 0)!
      .case_number;
    const response = await post(caseNumber, {
      action: 'escalate',
      comment: 'Sanctions hit needs compliance sign-off',
      analyst: 'Patrick',
    });
    const payload = await response.json();
    expect(response.status).toBe(201);
    expect(payload.case.status).toBe('escalated');
    expect(payload.action.analyst).toBe('Patrick');
  });

  it('rejects a missing comment with 400', async () => {
    const caseNumber = listCases()[0].case_number;
    const response = await post(caseNumber, { action: 'approve', comment: '', analyst: 'Daniel' });
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/comment is required/i);
  });

  it('rejects an unknown action with 400', async () => {
    const caseNumber = listCases()[0].case_number;
    const response = await post(caseNumber, {
      action: 'delete_everything',
      comment: 'nope',
      analyst: 'Daniel',
    });
    expect(response.status).toBe(400);
  });

  it('rejects an oversized comment with 400', async () => {
    const caseNumber = listCases()[0].case_number;
    const response = await post(caseNumber, {
      action: 'approve',
      comment: 'x'.repeat(MAX_COMMENT_LENGTH + 1),
      analyst: 'Daniel',
    });
    expect(response.status).toBe(400);
  });

  it('returns a clean 404 for an action on a non-existent case', async () => {
    const response = await post('KYC-MISSING', {
      action: 'approve',
      comment: 'Should not apply',
      analyst: 'Florence',
    });
    expect(response.status).toBe(404);
    expect((await response.json()).error).toMatch(/does not exist/);
  });

  it('returns 400 for a malformed JSON body', async () => {
    const request = new Request('http://localhost/api/cases/KYC-1000/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not json',
    });
    const response = await POST(request, { params: { caseNumber: 'KYC-1000' } });
    expect(response.status).toBe(400);
  });
});
