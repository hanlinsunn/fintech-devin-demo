import { NextResponse } from 'next/server';
import { getCase, listCaseActions } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: { caseNumber: string } }) {
  const kycCase = getCase(params.caseNumber);
  if (!kycCase) {
    return NextResponse.json({ error: `Case ${params.caseNumber} not found` }, { status: 404 });
  }
  return NextResponse.json({ case: kycCase, actions: listCaseActions(params.caseNumber) });
}
