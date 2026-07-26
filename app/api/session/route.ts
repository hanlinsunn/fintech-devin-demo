import { NextResponse } from 'next/server';
import { ANALYST_ROLES, SESSION_COOKIE, isAnalyst } from '@/lib/auth';
import { ANALYSTS } from '@/lib/domain';

export const dynamic = 'force-dynamic';

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  maxAge: 60 * 60 * 12,
} as const;

export async function POST(request: Request) {
  let body: { analyst?: string };
  try {
    body = (await request.json()) as { analyst?: string };
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON' }, { status: 400 });
  }

  if (!isAnalyst(body.analyst)) {
    return NextResponse.json(
      { error: `analyst must be one of: ${ANALYSTS.join(', ')}` },
      { status: 400 },
    );
  }

  const response = NextResponse.json({
    analyst: body.analyst,
    role: ANALYST_ROLES[body.analyst],
  });
  response.cookies.set(SESSION_COOKIE, body.analyst, COOKIE_OPTIONS);
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ analyst: null });
  response.cookies.set(SESSION_COOKIE, '', { ...COOKIE_OPTIONS, maxAge: 0 });
  return response;
}
