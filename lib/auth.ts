/**
 * Analyst identity and permissions.
 *
 * The prototype has no password-backed auth: the analyst picks who they are on the
 * sign-in screen and that choice is stored in a cookie. Permission to act on a case
 * is derived from the case itself — only the assigned analyst may act on it.
 */
import { ANALYSTS, type Analyst, type KycCase } from './domain';

export const SESSION_COOKIE = 'kyc_analyst';

export const NOT_AUTHORIZED_MESSAGE = 'Not authorized to take this action';

export type AnalystRole = 'senior analyst' | 'analyst';

export const ANALYST_ROLES: Record<Analyst, AnalystRole> = {
  Florence: 'senior analyst',
  Patrick: 'analyst',
  Daniel: 'analyst',
};

export function isAnalyst(value: string | null | undefined): value is Analyst {
  return typeof value === 'string' && (ANALYSTS as readonly string[]).includes(value);
}

/** Only the analyst a case is assigned to may take actions on it. */
export function canActOnCase(
  kycCase: Pick<KycCase, 'assigned_analyst'>,
  analyst: string | null | undefined,
): boolean {
  return isAnalyst(analyst) && kycCase.assigned_analyst === analyst;
}
