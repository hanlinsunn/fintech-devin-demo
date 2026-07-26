import { CaseQueue } from '@/components/CaseQueue';
import { listCases } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function QueuePage() {
  const cases = await listCases();
  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold">Review queue</h1>
      <p className="mb-6 text-sm text-slate-500">
        Flagged customer applications awaiting compliance review.
      </p>
      <CaseQueue cases={cases} />
    </>
  );
}
