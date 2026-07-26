import { notFound } from 'next/navigation';
import { CaseDetail } from '@/components/CaseDetail';
import { getCase, listCaseActions } from '@/lib/db';
import { getSessionAnalyst } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function CaseDetailPage({ params }: { params: { caseNumber: string } }) {
  const kycCase = await getCase(params.caseNumber);
  if (!kycCase) notFound();
  const actions = await listCaseActions(params.caseNumber);
  return (
    <CaseDetail
      kycCase={kycCase}
      actions={actions}
      sessionAnalyst={getSessionAnalyst()}
    />
  );
}
