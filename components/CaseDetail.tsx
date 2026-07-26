import Link from 'next/link';
import { ActionPanel } from './ActionPanel';
import { formatAge, type CaseAction, type KycCase } from '@/lib/domain';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-slate-900">{value}</dd>
    </div>
  );
}

/** Tones are whole colour sets: appending to a default would lose to Tailwind's source order. */
const PILL_TONES = {
  neutral: 'border-slate-200 bg-slate-100 text-slate-700',
  high: 'border-red-200 bg-red-50 text-red-800',
  medium: 'border-amber-200 bg-amber-50 text-amber-800',
} as const;

/** Rounded label sized to its own text: no truncation, wraps as a whole pill. */
function Pill({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: keyof typeof PILL_TONES;
}) {
  return (
    <li
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium capitalize ${PILL_TONES[tone]}`}
    >
      {children}
    </li>
  );
}

export function CaseDetail({
  kycCase,
  actions,
}: {
  kycCase: KycCase;
  actions: CaseAction[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/" className="text-sm text-blue-700 hover:underline">
          ← Back to queue
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">
          {kycCase.case_number} — {kycCase.full_name}
        </h1>
        <ul className="mt-3 flex flex-wrap items-center gap-2" aria-label="Case attributes">
          <Pill>{kycCase.reason_flagged}</Pill>
          <Pill tone={kycCase.risk_level}>{kycCase.risk_level} risk</Pill>
          <Pill>{kycCase.status.replace(/_/g, ' ')}</Pill>
          <Pill>open {formatAge(kycCase.created_at)}</Pill>
        </ul>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 flex flex-col gap-6">
          <div className="rounded border border-slate-200 bg-white p-5">
            <h2 className="mb-4 text-base font-semibold">Applicant information</h2>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" value={kycCase.full_name} />
              <Field label="Date of birth" value={kycCase.date_of_birth} />
              <Field label="Home address" value={kycCase.home_address} />
              <Field label="SSN" value={kycCase.ssn} />
              <Field label="Last utility bill address" value={kycCase.last_utility_bill_address} />
              <Field label="Driver's license number" value={kycCase.drivers_license_number} />
              <Field label="City" value={kycCase.city} />
              <Field label="Assigned analyst" value={kycCase.assigned_analyst} />
            </dl>
          </div>

          <div className="rounded border border-slate-200 bg-white p-5">
            <h2 className="mb-2 text-base font-semibold">Applicant notes</h2>
            <p className="text-sm text-slate-700">{kycCase.applicant_notes}</p>
          </div>

          <div className="rounded border border-slate-200 bg-white p-5">
            <h2 className="mb-2 text-base font-semibold">Audit log</h2>
            {actions.length === 0 ? (
              <p className="text-sm text-slate-500">No actions recorded yet.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {actions.map((action) => (
                  <li key={action.id} className="border-t border-slate-100 pt-3 text-sm first:border-0 first:pt-0">
                    <p className="font-medium">
                      {action.action} · {action.analyst}
                    </p>
                    <p className="text-slate-600">{action.comment}</p>
                    <p className="text-xs text-slate-400">{action.created_at}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <aside>
          <ActionPanel caseNumber={kycCase.case_number} currentAnalyst={kycCase.assigned_analyst} />
        </aside>
      </div>
    </div>
  );
}
