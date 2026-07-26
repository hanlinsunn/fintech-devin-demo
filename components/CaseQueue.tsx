'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  CASE_STATUSES,
  RISK_LEVELS,
  ageInDays,
  formatAge,
  maskSsn,
  type CaseStatus,
  type KycCase,
  type RiskLevel,
} from '@/lib/domain';

type SortKey = 'age' | 'risk_level' | 'status';
type SortDirection = 'asc' | 'desc';

const RISK_ORDER: Record<RiskLevel, number> = { medium: 0, high: 1 };

function statusLabel(status: CaseStatus): string {
  return status.replace(/_/g, ' ');
}

export function CaseQueue({ cases }: { cases: KycCase[] }) {
  const [riskFilter, setRiskFilter] = useState<'all' | RiskLevel>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | CaseStatus>('all');
  const [sortKey, setSortKey] = useState<SortKey>('age');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const visibleCases = useMemo(() => {
    const filtered = cases.filter(
      (c) =>
        (riskFilter === 'all' || c.risk_level === riskFilter) &&
        (statusFilter === 'all' || c.status === statusFilter),
    );
    const sorted = [...filtered].sort((a, b) => {
      if (sortKey === 'age') return ageInDays(a.created_at) - ageInDays(b.created_at);
      if (sortKey === 'risk_level') return RISK_ORDER[a.risk_level] - RISK_ORDER[b.risk_level];
      return a.status.localeCompare(b.status);
    });
    return sortDirection === 'asc' ? sorted : sorted.reverse();
  }, [cases, riskFilter, statusFilter, sortKey, sortDirection]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  }

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="risk-filter" className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Risk level
          </label>
          <select
            id="risk-filter"
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value as 'all' | RiskLevel)}
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="all">All risk levels</option>
            {RISK_LEVELS.map((risk) => (
              <option key={risk} value={risk}>
                {risk}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="status-filter" className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Status
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | CaseStatus)}
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="all">All statuses</option>
            {CASE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status)}
              </option>
            ))}
          </select>
        </div>
        <p className="ml-auto text-sm text-slate-500" data-testid="result-count">
          {visibleCases.length} of {cases.length} cases
        </p>
      </div>

      {cases.length === 0 ? (
        <p className="rounded border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          The review queue is empty. No flagged applications are waiting.
        </p>
      ) : (
        <div className="overflow-x-auto rounded border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th scope="col" className="px-4 py-3">Case number</th>
                <th scope="col" className="px-4 py-3">Full name</th>
                <th scope="col" className="px-4 py-3">SSN</th>
                <th scope="col" className="px-4 py-3">Reason flagged</th>
                <th scope="col" className="px-4 py-3">
                  <button type="button" onClick={() => toggleSort('risk_level')} className="uppercase">
                    Risk level
                  </button>
                </th>
                <th scope="col" className="px-4 py-3">
                  <button type="button" onClick={() => toggleSort('age')} className="uppercase">
                    Age of request
                  </button>
                </th>
                <th scope="col" className="px-4 py-3">
                  <button type="button" onClick={() => toggleSort('status')} className="uppercase">
                    Status
                  </button>
                </th>
                <th scope="col" className="px-4 py-3">Assigned analyst</th>
                <th scope="col" className="px-4 py-3">City</th>
              </tr>
            </thead>
            <tbody>
              {visibleCases.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                    No cases match the selected filters.
                  </td>
                </tr>
              ) : (
                visibleCases.map((c) => (
                  <tr key={c.case_number} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/cases/${c.case_number}`} className="text-blue-700 hover:underline">
                        {c.case_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{c.full_name}</td>
                    <td className="px-4 py-3 tabular-nums">{maskSsn(c.ssn)}</td>
                    <td className="px-4 py-3">{c.reason_flagged}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          c.risk_level === 'high'
                            ? 'rounded bg-red-100 px-2 py-1 text-xs font-semibold text-red-800'
                            : 'rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800'
                        }
                      >
                        {c.risk_level}
                      </span>
                    </td>
                    <td className="px-4 py-3">{formatAge(c.created_at)}</td>
                    <td className="px-4 py-3">{statusLabel(c.status)}</td>
                    <td className="px-4 py-3">{c.assigned_analyst}</td>
                    <td className="px-4 py-3">{c.city}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
