import { cookies } from 'next/headers';
import { SESSION_COOKIE, isAnalyst } from './auth';
import type { Analyst } from './domain';

/** The signed-in analyst for the current request, or null when nobody is signed in. */
export function getSessionAnalyst(): Analyst | null {
  const value = cookies().get(SESSION_COOKIE)?.value;
  return isAnalyst(value) ? value : null;
}
