import type { KycCase } from '@/lib/domain';

const BASE: KycCase = {
  case_number: 'KYC-0001',
  full_name: 'Alice Whitaker',
  date_of_birth: '1988-04-02',
  home_address: '512 Maple St, Denver, CO 80205',
  ssn: '412-88-7391',
  last_utility_bill_address: '98 Oak Ave, Denver, CO 80206',
  drivers_license_number: 'CO-4471029',
  applicant_notes: 'Applicant moved recently, so the license still shows the old address.',
  reason_flagged: 'address mismatch',
  risk_level: 'medium',
  city: 'Denver',
  created_at: new Date().toISOString(),
  status: 'pending_review',
  assigned_analyst: 'Patrick',
  approvable: 1,
};

export function makeCase(overrides: Partial<KycCase> = {}): KycCase {
  return { ...BASE, ...overrides };
}

/** `createdAt` timestamp for a case opened `days` ago. */
export function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}
