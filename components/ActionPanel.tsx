'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AnalystPicker } from './AnalystPicker';
import { NOT_AUTHORIZED_MESSAGE } from '@/lib/auth';
import { ANALYSTS, CASE_ACTIONS, MAX_COMMENT_LENGTH, type CaseActionType } from '@/lib/domain';

const ACTION_LABELS: Record<CaseActionType, string> = {
  approve: 'Approve',
  reject: 'Reject',
  request_docs: 'Request documents',
  escalate: 'Escalate',
  reassign: 'Reassign',
};

export function ActionPanel({
  caseNumber,
  assignedAnalyst,
  authorized,
}: {
  caseNumber: string;
  assignedAnalyst: string;
  /** False when the signed-in analyst is not the one the case is assigned to. */
  authorized: boolean;
}) {
  const router = useRouter();
  // Empty until the analyst picks deliberately; no action is a safe default.
  const [action, setAction] = useState<CaseActionType | ''>('');
  const [comment, setComment] = useState('');
  const [assignTo, setAssignTo] = useState<string>(
    ANALYSTS.find((a) => a !== assignedAnalyst) ?? ANALYSTS[0],
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const canSubmit = authorized && action !== '' && comment.trim().length > 0 && !submitting;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/cases/${caseNumber}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          comment,
          ...(action === 'reassign' ? { assignTo } : {}),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? 'Unable to record the action');
        return;
      }
      setComment('');
      setMessage(`Recorded ${ACTION_LABELS[action]} on ${caseNumber}`);
      setAction('');
      router.refresh();
    } catch {
      setError('Unable to record the action');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded border border-slate-200 bg-white p-5"
      aria-label="Case action panel"
    >
      <h2 className="text-base font-semibold">Take action</h2>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Acting analyst
        </span>
        <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {assignedAnalyst}
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="action" className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Action
        </label>
        <select
          id="action"
          value={action}
          disabled={!authorized}
          onChange={(e) => setAction(e.target.value as CaseActionType | '')}
          className="rounded border border-slate-300 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        >
          <option value="">Select an action…</option>
          {CASE_ACTIONS.map((value) => (
            <option key={value} value={value}>
              {ACTION_LABELS[value]}
            </option>
          ))}
        </select>
      </div>

      {action === 'reassign' && (
        <AnalystPicker
          value={assignTo}
          onChange={setAssignTo}
          label="Reassign to"
          id="assign-to"
          disabled={!authorized}
        />
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="comment" className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Comment (required)
        </label>
        <textarea
          id="comment"
          value={comment}
          maxLength={MAX_COMMENT_LENGTH}
          disabled={!authorized}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          className="rounded border border-slate-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-slate-100"
          placeholder="Explain the decision for the audit log"
        />
        <span className="text-xs text-slate-400">
          {comment.length}/{MAX_COMMENT_LENGTH}
        </span>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-green-700">
          {message}
        </p>
      )}

      <div className="group relative">
        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {submitting ? 'Submitting…' : 'Submit action'}
        </button>
        {!authorized && (
          <span
            role="tooltip"
            className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-xs text-white group-hover:block"
          >
            {NOT_AUTHORIZED_MESSAGE}
          </span>
        )}
      </div>

      {!authorized && (
        <p role="alert" className="text-sm text-red-700">
          {NOT_AUTHORIZED_MESSAGE} — {assignedAnalyst} is assigned to {caseNumber}.
        </p>
      )}
    </form>
  );
}
