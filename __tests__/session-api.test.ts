/**
 * @jest-environment node
 */
import { DELETE, POST } from '@/app/api/session/route';
import { SESSION_COOKIE } from '@/lib/auth';

function signIn(body: unknown) {
  return POST(
    new Request('http://localhost/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

describe('POST /api/session', () => {
  it('sets the session cookie for a known analyst', async () => {
    const response = await signIn({ analyst: 'Florence' });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ analyst: 'Florence', role: 'senior analyst' });
    expect(response.cookies.get(SESSION_COOKIE)?.value).toBe('Florence');
  });

  it('rejects an unknown analyst', async () => {
    const response = await signIn({ analyst: 'Mallory' });
    expect(response.status).toBe(400);
    expect(response.cookies.get(SESSION_COOKIE)?.value).toBeUndefined();
  });
});

describe('DELETE /api/session', () => {
  it('clears the session cookie', async () => {
    const response = await DELETE();
    expect(response.status).toBe(200);
    expect(response.cookies.get(SESSION_COOKIE)?.value).toBe('');
  });
});
