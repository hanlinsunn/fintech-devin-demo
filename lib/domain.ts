export const REASONS_FLAGGED = [
  'identity mismatch',
  'address mismatch',
  'document issues',
  'sanctions watchlist',
  'duplicate request',
] as const;
export type ReasonFlagged = (typeof REASONS_FLAGGED)[number];

export const RISK_LEVELS = ['medium', 'high'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const CASE_STATUSES = [
  'pending_review',
  'approved',
  'rejected',
  'docs_requested',
  'escalated',
  'reassigned',
] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const CASE_ACTIONS = ['approve', 'reject', 'request_docs', 'escalate', 'reassign'] as const;
export type CaseActionType = (typeof CASE_ACTIONS)[number];

export const ANALYSTS = ['Florence', 'Patrick', 'Daniel'] as const;
export type Analyst = (typeof ANALYSTS)[number];

/** Status a case lands in after each action. */
export const ACTION_TO_STATUS: Record<CaseActionType, CaseStatus> = {
  approve: 'approved',
  reject: 'rejected',
  request_docs: 'docs_requested',
  escalate: 'escalated',
  reassign: 'reassigned',
};

export const MAX_COMMENT_LENGTH = 2000;

/** Real US cities used by the seed data and validated by the seed-integrity tests. */
export const US_CITIES = [
  'New York',
  'Los Angeles',
  'Chicago',
  'Houston',
  'Phoenix',
  'Philadelphia',
  'San Antonio',
  'San Diego',
  'Dallas',
  'Austin',
  'Jacksonville',
  'San Jose',
  'Fort Worth',
  'Columbus',
  'Charlotte',
  'Indianapolis',
  'San Francisco',
  'Seattle',
  'Denver',
  'Nashville',
  'Oklahoma City',
  'Boston',
  'Las Vegas',
  'Portland',
  'Detroit',
  'Memphis',
  'Louisville',
  'Milwaukee',
  'Baltimore',
  'Albuquerque',
  'Tucson',
  'Fresno',
  'Sacramento',
  'Kansas City',
  'Mesa',
  'Atlanta',
  'Omaha',
  'Raleigh',
  'Miami',
  'Minneapolis',
  'Tampa',
  'New Orleans',
  'Cleveland',
  'Pittsburgh',
  'St. Louis',
  'Cincinnati',
  'Salt Lake City',
  'Boise',
  'Richmond',
  'Des Moines',
] as const;

export interface KycCase {
  case_number: string;
  full_name: string;
  date_of_birth: string;
  home_address: string;
  ssn: string;
  last_utility_bill_address: string;
  drivers_license_number: string;
  applicant_notes: string;
  reason_flagged: ReasonFlagged;
  risk_level: RiskLevel;
  city: string;
  created_at: string;
  status: CaseStatus;
  assigned_analyst: Analyst;
  /** 1 when the seed data considers the case a clear approval candidate. */
  approvable: 0 | 1;
}

export interface CaseAction {
  id: number;
  case_number: string;
  action: CaseActionType;
  comment: string;
  analyst: string;
  created_at: string;
}

/** Masks all but the last four digits of an SSN, for use in the queue view. */
export function maskSsn(ssn: string): string {
  const last4 = ssn.replace(/\D/g, '').slice(-4);
  return `***-**-${last4}`;
}

/** Whole days between `createdAt` and `now`, used for the "age of request" column. */
export function ageInDays(createdAt: string, now: Date = new Date()): number {
  const created = new Date(createdAt).getTime();
  const diffMs = now.getTime() - created;
  return Math.max(0, Math.floor(diffMs / 86_400_000));
}

export function formatAge(createdAt: string, now: Date = new Date()): string {
  const days = ageInDays(createdAt, now);
  if (days === 0) return 'today';
  if (days === 1) return '1 day';
  return `${days} days`;
}
