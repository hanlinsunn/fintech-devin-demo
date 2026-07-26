import { NextResponse } from 'next/server';
import { listCases } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ cases: await listCases() });
}
