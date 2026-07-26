import { notFound } from 'next/navigation';
import { CaseDetail } from '@/components/CaseDetail';
import { getCase, listCaseActions } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default function CaseDetailPage({ params }: { params: { caseNumber: string } }) {
  const kycCase = getCase(params.caseNumber);
  if (!kycCase) notFound();
  return <CaseDetail kycCase={kycCase} actions={listCaseActions(params.caseNumber)} />;
}
