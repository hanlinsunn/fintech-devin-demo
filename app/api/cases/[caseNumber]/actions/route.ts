import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { CaseNotFoundError, ValidationError, recordAction } from '@/lib/db';
import { CASE_ACTIONS, type CaseActionType } from '@/lib/domain';

export const dynamic = 'force-dynamic';

interface ActionBody {
  action?: string;
  comment?: string;
  /** Acting analyst identity; a first-class field so role checks can be added later. */
  analyst?: string;
  assignTo?: string;
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

  try {
    const result = recordAction({
      caseNumber: params.caseNumber,
      action: body.action as CaseActionType,
      comment: body.comment ?? '',
      analyst: body.analyst ?? '',
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
