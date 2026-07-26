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

type SortKey =
  | 'case_number'
  | 'full_name'
  | 'ssn'
  | 'reason_flagged'
  | 'risk_level'
  | 'age'
  | 'status'
  | 'assigned_analyst'
  | 'city';

type SortDirection = 'asc' | 'desc';

interface SortState {
  key: SortKey;
  direction: SortDirection;
}

const RISK_ORDER: Record<RiskLevel, number> = { medium: 0, high: 1 };

/** Ascending comparators; descending reuses them negated. */
const COMPARATORS: Record<SortKey, (a: KycCase, b: KycCase) => number> = {
  case_number: (a, b) => a.case_number.localeCompare(b.case_number, 'en', { numeric: true }),
  full_name: (a, b) => a.full_name.localeCompare(b.full_name),
  ssn: (a, b) => a.ssn.localeCompare(b.ssn),
  reason_flagged: (a, b) => a.reason_flagged.localeCompare(b.reason_flagged),
  risk_level: (a, b) => RISK_ORDER[a.risk_level] - RISK_ORDER[b.risk_level],
  age: (a, b) => ageInDays(a.created_at) - ageInDays(b.created_at),
  status: (a, b) => a.status.localeCompare(b.status),
  assigned_analyst: (a, b) => a.assigned_analyst.localeCompare(b.assigned_analyst),
  city: (a, b) => a.city.localeCompare(b.city),
};

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'case_number', label: 'Case number' },
  { key: 'full_name', label: 'Full name' },
  { key: 'ssn', label: 'SSN' },
  { key: 'reason_flagged', label: 'Reason flagged' },
  { key: 'risk_level', label: 'Risk level' },
  { key: 'age', label: 'Age of request' },
  { key: 'status', label: 'Status' },
  { key: 'assigned_analyst', label: 'Assigned analyst' },
  { key: 'city', label: 'City' },
];

const PAGE_SIZE = 25;

function statusLabel(status: CaseStatus): string {
  return status.replace(/_/g, ' ');
}

/** Stacked arrows: both muted when the column is unsorted, active one highlighted. */
function SortArrows({ direction }: { direction: SortDirection | null }) {
  return (
    <span aria-hidden className="ml-1 inline-flex flex-col leading-none">
      <span className={direction === 'asc' ? 'text-slate-900' : 'text-slate-400'}>▲</span>
      <span className={direction === 'desc' ? 'text-slate-900' : 'text-slate-400'}>▼</span>
    </span>
  );
}

export function CaseQueue({ cases }: { cases: KycCase[] }) {
  const [riskFilter, setRiskFilter] = useState<'all' | RiskLevel>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | CaseStatus>('all');
  const [sort, setSort] = useState<SortState | null>(null);
  const [page, setPage] = useState(1);

  const visibleCases = useMemo(() => {
    const filtered = cases.filter(
      (c) =>
        (riskFilter === 'all' || c.risk_level === riskFilter) &&
        (statusFilter === 'all' || c.status === statusFilter),
    );
    if (!sort) return filtered;
    const compare = COMPARATORS[sort.key];
    const factor = sort.direction === 'asc' ? 1 : -1;
    // Array.prototype.sort is stable, so equal rows keep the default queue order.
    return [...filtered].sort((a, b) => factor * compare(a, b));
  }, [cases, riskFilter, statusFilter, sort]);

  const pageCount = Math.max(1, Math.ceil(visibleCases.length / PAGE_SIZE));
  // Clamped rather than stored, so filtering down to fewer pages can't strand the view.
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageCases = visibleCases.slice(pageStart, pageStart + PAGE_SIZE);

  /** Cycles a column through ascending → descending → unsorted. */
  function toggleSort(key: SortKey) {
    setPage(1);
    setSort((current) => {
      if (current?.key !== key) return { key, direction: 'asc' };
      if (current.direction === 'asc') return { key, direction: 'desc' };
      return null;
    });
  }

  function directionFor(key: SortKey): SortDirection | null {
    return sort?.key === key ? sort.direction : null;
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
            onChange={(e) => {
              setRiskFilter(e.target.value as 'all' | RiskLevel);
              setPage(1);
            }}
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
            onChange={(e) => {
              setStatusFilter(e.target.value as 'all' | CaseStatus);
              setPage(1);
            }}
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
        <div className="rounded border border-slate-200 bg-white">
          {/* Rows scroll inside the table area so the page itself stays put. */}
          <div className="max-h-[70vh] overflow-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-100 text-xs uppercase tracking-wide text-slate-600 shadow-[inset_0_-1px_0_theme(colors.slate.200)]">
                <tr>
                  {COLUMNS.map(({ key, label }) => {
                    const direction = directionFor(key);
                    return (
                      <th
                        key={key}
                        scope="col"
                        className="px-4 py-3"
                        aria-sort={
                          direction === 'asc'
                            ? 'ascending'
                            : direction === 'desc'
                              ? 'descending'
                              : 'none'
                        }
                      >
                        <button
                          type="button"
                          onClick={() => toggleSort(key)}
                          title={
                            direction === null
                              ? `Sort by ${label} ascending`
                              : direction === 'asc'
                                ? `Sort by ${label} descending`
                                : `Clear sorting on ${label}`
                          }
                          className="flex items-center whitespace-nowrap uppercase hover:text-slate-900"
                        >
                          {label}
                          <SortArrows direction={direction} />
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {pageCases.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMNS.length} className="px-4 py-8 text-center text-slate-500">
                      No cases match the selected filters.
                    </td>
                  </tr>
                ) : (
                  pageCases.map((c) => (
                    <tr key={c.case_number} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium">
                        <Link href={`/cases/${c.case_number}`} className="text-blue-700 hover:underline">
                          {c.case_number}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">{c.full_name}</td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums">{maskSsn(c.ssn)}</td>
                      <td className="whitespace-nowrap px-4 py-3">{c.reason_flagged}</td>
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
                      <td className="whitespace-nowrap px-4 py-3">{formatAge(c.created_at)}</td>
                      <td className="whitespace-nowrap px-4 py-3">{statusLabel(c.status)}</td>
                      <td className="whitespace-nowrap px-4 py-3">{c.assigned_analyst}</td>
                      <td className="whitespace-nowrap px-4 py-3">{c.city}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <nav
            aria-label="Queue pagination"
            className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm"
          >
            <p className="text-slate-500" data-testid="page-range">
              {visibleCases.length === 0
                ? 'No cases to show'
                : `Showing ${pageStart + 1}\u2013${pageStart + pageCases.length} of ${visibleCases.length}`}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-slate-500" data-testid="page-indicator">
                Page {currentPage} of {pageCount}
              </span>
              <button
                type="button"
                onClick={() => setPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="rounded border border-slate-300 px-3 py-1 disabled:cursor-not-allowed disabled:text-slate-300"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage(currentPage + 1)}
                disabled={currentPage === pageCount}
                className="rounded border border-slate-300 px-3 py-1 disabled:cursor-not-allowed disabled:text-slate-300"
              >
                Next
              </button>
            </div>
          </nav>
        </div>
      )}
    </section>
  );
}
