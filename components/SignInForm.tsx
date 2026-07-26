'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ANALYST_ROLES } from '@/lib/auth';
import { ANALYSTS, type Analyst } from '@/lib/domain';

export function SignInForm() {
  const router = useRouter();
  const [analyst, setAnalyst] = useState<Analyst>(ANALYSTS[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analyst }),
      });
      if (!response.ok) {
        setError('Unable to sign in');
        return;
      }
      router.replace('/');
      router.refresh();
    } catch {
      setError('Unable to sign in');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Sign in"
      className="mx-auto flex w-full max-w-sm flex-col gap-4 rounded border border-slate-200 bg-white p-6"
    >
      <div>
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-slate-500">
          Choose the analyst you are reviewing cases as.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="sign-in-analyst" className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Sign in as
        </label>
        <select
          id="sign-in-analyst"
          value={analyst}
          onChange={(event) => setAnalyst(event.target.value as Analyst)}
          className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          {ANALYSTS.map((name) => (
            <option key={name} value={name}>
              {name} ({ANALYST_ROLES[name]})
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {submitting ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
