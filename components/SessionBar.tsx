'use client';

import { useRouter } from 'next/navigation';
import { ANALYST_ROLES } from '@/lib/auth';
import type { Analyst } from '@/lib/domain';

export function SessionBar({ analyst }: { analyst: Analyst }) {
  const router = useRouter();

  async function signOut() {
    await fetch('/api/session', { method: 'DELETE' });
    router.replace('/sign-in');
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-slate-600">
        Signed in as <span className="font-semibold text-slate-900">{analyst}</span> ·{' '}
        {ANALYST_ROLES[analyst]}
      </span>
      <button
        type="button"
        onClick={signOut}
        className="rounded border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
      >
        Sign out
      </button>
    </div>
  );
}
