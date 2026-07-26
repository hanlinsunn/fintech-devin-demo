import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { CaseNotFoundError, ValidationError, getCase, recordAction } from '@/lib/db';
import { NOT_AUTHORIZED_MESSAGE, SESSION_COOKIE, canActOnCase, isAnalyst } from '@/lib/auth';
import { CASE_ACTIONS, type CaseActionType } from '@/lib/domain';

export const dynamic = 'force-dynamic';

interface ActionBody {
  action?: string;
  comment?: string;
  /** Fallback acting identity for API clients that carry no session cookie. */
  analyst?: string;
  assignTo?: string;
}

/** The session cookie is the acting identity; the body is only a fallback for API clients. */
function actingAnalyst(request: Request, body: ActionBody): string {
  const cookie = request.headers
    .get('cookie')
    ?.split(';')
    .map((part) => part.trim().split('='))
    .find(([name]) => name === SESSION_COOKIE)?.[1];
  return isAnalyst(cookie) ? cookie : body.analyst ?? '';
}

export async function POST(request: Request, { params }: { params: { caseNumber: string } }) {
  let body: ActionBody;
  try {
    body = (await request.json()) as ActionBody;
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON' }, { status: 400 });
  }

  if (!body.action || !CASE_ACTIONS.includes(body.action as CaseActionType)) {
    return NextResponse.json(
      { error: `action must be one of: ${CASE_ACTIONS.join(', ')}` },
      { status: 400 },
    );
  }

  const analyst = actingAnalyst(request, body);
  const kycCase = await getCase(params.caseNumber);
  if (!kycCase) {
    return NextResponse.json(
      { error: new CaseNotFoundError(params.caseNumber).message },
      { status: 404 },
    );
  }
  if (!canActOnCase(kycCase, analyst)) {
    return NextResponse.json({ error: NOT_AUTHORIZED_MESSAGE }, { status: 403 });
  }

  try {
    const result = await recordAction({
      caseNumber: params.caseNumber,
      action: body.action as CaseActionType,
      comment: body.comment ?? '',
      analyst,
      assignTo: body.assignTo,
    });
    revalidatePath('/');
    revalidatePath(`/cases/${params.caseNumber}`);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof CaseNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}
