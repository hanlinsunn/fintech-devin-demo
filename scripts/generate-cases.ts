/**
 * Generates `data/cases.csv`, the fake seed data for the KYC review queue.
 *
 * Run with `npm run generate:seed`. Field values come from a seeded PRNG; only
 * `created_at` is relative to the generation date so the queue always shows a
 * realistic spread of request ages.
 *
 * Data-generation constraints enforced here (deliberately NOT in app logic):
 *  - every `reason_flagged` is one of the five allowed values
 *  - `assigned_analyst` is Florence | Patrick | Daniel
 *  - every high-risk case is assigned to Florence
 *  - `city` is a real US city
 *  - exactly 50 cases are approvable, each with a justification in applicant_notes
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import {
  ANALYSTS,
  CASE_STATUSES,
  REASONS_FLAGGED,
  US_CITIES,
  type Analyst,
  type CaseStatus,
  type KycCase,
  type ReasonFlagged,
  type RiskLevel,
} from '../lib/domain';

const TOTAL_CASES = 165;
const APPROVABLE_CASES = 50;

/** Deterministic mulberry32 PRNG so regenerating the CSV is reproducible. */
function createRng(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = createRng(20240917);

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

function randInt(min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

const FIRST_NAMES = [
  'Alice', 'Marcus', 'Priya', 'Jordan', 'Elena', 'Tomas', 'Nia', 'Wesley', 'Hana', 'Diego',
  'Ruth', 'Owen', 'Camila', 'Silas', 'Ingrid', 'Rashid', 'Beatriz', 'Cole', 'Yara', 'Devon',
  'Maren', 'Isaac', 'Lucia', 'Grant', 'Aisha', 'Felix', 'Noor', 'Bryce', 'Talia', 'Emeka',
  'Rosa', 'Levi', 'Sana', 'Corey', 'Mira', 'Dante', 'Freya', 'Nolan', 'Zaina', 'Hugo',
];

const LAST_NAMES = [
  'Whitaker', 'Okafor', 'Nakamura', 'Delgado', 'Brennan', 'Kaur', 'Silva', 'Kowalski',
  'Fitzgerald', 'Mbeki', 'Alvarez', 'Petrov', 'Haddad', 'Lindqvist', 'Moreau', 'Chandler',
  'Nguyen', 'Osei', 'Ramirez', 'Sokolov', 'Yamada', 'Barlow', 'Ferreira', 'Kirkland',
  'Novak', 'Abbas', 'Castellano', 'Dupont', 'Ellison', 'Farrow',
];

const STREETS = [
  'Maple St', 'Oak Ave', 'Cedar Ln', 'Birch Rd', 'Sunset Blvd', 'Lakeview Dr', 'Franklin St',
  'Chestnut Ave', 'Mill Creek Rd', 'Harborview Way', 'Juniper Ct', 'Prospect Ave',
  'Willowbrook Dr', 'Kingston Pl', 'Ridgeway Ter',
];

const STATE_BY_CITY: Record<string, string> = {
  'New York': 'NY', 'Los Angeles': 'CA', Chicago: 'IL', Houston: 'TX', Phoenix: 'AZ',
  Philadelphia: 'PA', 'San Antonio': 'TX', 'San Diego': 'CA', Dallas: 'TX', Austin: 'TX',
  Jacksonville: 'FL', 'San Jose': 'CA', 'Fort Worth': 'TX', Columbus: 'OH', Charlotte: 'NC',
  Indianapolis: 'IN', 'San Francisco': 'CA', Seattle: 'WA', Denver: 'CO', Nashville: 'TN',
  'Oklahoma City': 'OK', Boston: 'MA', 'Las Vegas': 'NV', Portland: 'OR', Detroit: 'MI',
  Memphis: 'TN', Louisville: 'KY', Milwaukee: 'WI', Baltimore: 'MD', Albuquerque: 'NM',
  Tucson: 'AZ', Fresno: 'CA', Sacramento: 'CA', 'Kansas City': 'MO', Mesa: 'AZ',
  Atlanta: 'GA', Omaha: 'NE', Raleigh: 'NC', Miami: 'FL', Minneapolis: 'MN', Tampa: 'FL',
  'New Orleans': 'LA', Cleveland: 'OH', Pittsburgh: 'PA', 'St. Louis': 'MO',
  Cincinnati: 'OH', 'Salt Lake City': 'UT', Boise: 'ID', Richmond: 'VA', 'Des Moines': 'IA',
};

/** Benign explanations that justify approval, keyed by the reason the case was flagged. */
const APPROVABLE_NOTES: Record<ReasonFlagged, string[]> = {
  'identity mismatch': [
    'Name on the application is the applicant\'s married name; the government ID still shows the maiden name and a certified marriage certificate was uploaded.',
    'Middle name was truncated by our onboarding form, causing a mismatch against the credit bureau record; passport and SSN card both match once the full name is used.',
    'Applicant is a junior with the same name as their father, which triggered the mismatch; DOB and SSN on the submitted ID confirm the correct individual.',
    'Transliteration difference between the applicant\'s passport (Aleksandr) and their US documents (Alexander); both documents share the same DOB and SSN.',
  ],
  'address mismatch': [
    'Address mismatch because the applicant moved three weeks ago, so the driver\'s license still shows the previous address; a current lease and utility bill were provided.',
    'Applicant is a university student living on campus, so the license reflects the family home address; dorm housing letter confirms the current address.',
    'Mismatch caused by a USPS apartment-unit formatting difference (Apt 4B vs #4B); both documents describe the same residence.',
    'Applicant relocated for a job transfer and the utility account was opened in the same week; employer relocation letter and new utility bill both match the application.',
  ],
  'document issues': [
    'Document issues due to a legal name change after marriage; supporting court order and updated Social Security card were provided.',
    'The uploaded license image was cut off on the first attempt; a clear re-upload of both sides is on file and all fields are legible.',
    'License had expired eight days before submission; applicant supplied the DMV renewal receipt and the newly issued license.',
    'Applicant\'s utility bill was a paperless PDF without a visible letterhead; the issuer confirmed authenticity via a stamped duplicate statement.',
  ],
  'sanctions watchlist': [
    'Watchlist hit is a false positive on a common surname; the listed individual has a different DOB and nationality, confirmed against the applicant\'s passport.',
    'Screening matched a politically exposed person with the same name in another country; the applicant is a US-born resident with an unrelated DOB and SSN.',
    'Fuzzy-match alert triggered at 78% similarity on a transliterated name; manual review against the sanctions record shows no shared identifiers.',
    'Prior alert on this applicant was cleared by compliance last quarter; the same false-positive hit re-fired after a list refresh.',
  ],
  'duplicate request': [
    'Duplicate created when the applicant\'s browser session timed out and they resubmitted; the earlier record was abandoned with no documents attached.',
    'Applicant applied once as a sole proprietor and once as an individual; the individual application is the one they intend to keep open.',
    'Duplicate resulted from our retry logic double-posting the onboarding form; both records share identical PII and a single applicant.',
    'Applicant re-applied after their first application was auto-closed for inactivity; documents on the new record are current.',
  ],
};

/** Genuinely risky or ambiguous narratives for the non-approvable cases. */
const RISKY_NOTES: Record<ReasonFlagged, string[]> = {
  'identity mismatch': [
    'SSN provided belongs to a different date of birth per bureau records and the applicant declined to clarify.',
    'Applicant supplied two different dates of birth across the application and the uploaded ID; no explanation offered.',
    'ID photo appears digitally altered around the name field; selfie liveness check also failed twice.',
    'Applicant could not answer knowledge-based authentication questions tied to their own credit file.',
  ],
  'address mismatch': [
    'Home address is a known commercial mail-drop; applicant insists it is a residence but provided no lease.',
    'Utility bill address is in a different state and the account holder name does not match the applicant.',
    'Three unrelated applications in the last month list this same address with different names.',
    'Applicant refused to provide proof of residence and asked whether the requirement could be waived.',
  ],
  'document issues': [
    'Uploaded license has inconsistent font kerning and a missing state hologram; likely a fabricated document.',
    'Utility bill PDF metadata shows it was created in an image editor the same day it was uploaded.',
    'Applicant submitted the same document three times with different expiry dates edited in.',
    'Document is a photograph of a screen rather than the original; applicant declined to re-upload.',
  ],
  'sanctions watchlist': [
    'Exact name, DOB, and nationality match against an OFAC SDN entry; escalation to compliance required.',
    'Applicant shares an address with a sanctioned entity and lists them as an emergency contact.',
    'Strong match on an EU sanctions list; applicant became evasive when asked about prior employers.',
    'Applicant appears on an adverse-media list for wire fraud allegations in two jurisdictions.',
  ],
  'duplicate request': [
    'Fourth application in six weeks, each with slightly different PII; possible synthetic identity testing.',
    'Duplicate record uses the same SSN but a different name and DOB.',
    'Two applications submitted minutes apart from different countries by IP.',
    'Duplicate submissions each attach documents belonging to different people.',
  ],
};

function makeSsn(): string {
  return `${randInt(100, 899)}-${String(randInt(1, 99)).padStart(2, '0')}-${String(randInt(0, 9999)).padStart(4, '0')}`;
}

function makeDob(): string {
  const year = randInt(1955, 2003);
  const month = randInt(1, 12);
  const day = randInt(1, 28);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function makeAddress(city: string): string {
  return `${randInt(12, 9899)} ${pick(STREETS)}, ${city}, ${STATE_BY_CITY[city]} ${String(randInt(10000, 99999))}`;
}

function makeLicense(city: string): string {
  const state = STATE_BY_CITY[city];
  return `${state}-${String(randInt(1000000, 9999999))}`;
}

const GENERATED_AT = Date.now();

function makeCreatedAt(index: number): string {
  // Spread cases over the last ~120 days so "age of request" varies.
  const daysAgo = randInt(0, 120);
  const base = GENERATED_AT - daysAgo * 86_400_000 - index * 1000;
  return new Date(base).toISOString();
}

function assignAnalyst(risk: RiskLevel): Analyst {
  if (risk === 'high') return 'Florence';
  // Medium-risk work is spread across all three analysts.
  return pick(ANALYSTS);
}

function pickStatus(approvable: boolean): CaseStatus {
  // Most of the queue is still awaiting review; the rest shows historical outcomes.
  if (rng() < 0.62) return 'pending_review';
  const resolved = CASE_STATUSES.filter((s) => s !== 'pending_review');
  if (approvable) return pick(['pending_review', 'approved', 'docs_requested'] as CaseStatus[]);
  return pick(resolved);
}

function buildCases(): KycCase[] {
  const cases: KycCase[] = [];
  for (let i = 0; i < TOTAL_CASES; i += 1) {
    const approvable = i < APPROVABLE_CASES;
    const reason = REASONS_FLAGGED[i % REASONS_FLAGGED.length];
    // Approvable cases skew medium risk; the rest carry a heavier high-risk share.
    const risk: RiskLevel = approvable ? (rng() < 0.2 ? 'high' : 'medium') : rng() < 0.5 ? 'high' : 'medium';
    const city = pick(US_CITIES);
    const homeAddress = makeAddress(city);
    const notes = approvable
      ? pick(APPROVABLE_NOTES[reason])
      : pick(RISKY_NOTES[reason]);
    const utilityAddress =
      reason === 'address mismatch' || rng() < 0.25 ? makeAddress(pick(US_CITIES)) : homeAddress;

    cases.push({
      case_number: `KYC-${1000 + i}`,
      full_name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
      date_of_birth: makeDob(),
      home_address: homeAddress,
      ssn: makeSsn(),
      last_utility_bill_address: utilityAddress,
      drivers_license_number: makeLicense(city),
      applicant_notes: notes,
      reason_flagged: reason,
      risk_level: risk,
      city,
      created_at: makeCreatedAt(i),
      status: pickStatus(approvable),
      assigned_analyst: assignAnalyst(risk),
      approvable: approvable ? 1 : 0,
    });
  }
  return cases;
}

export const CSV_COLUMNS: (keyof KycCase)[] = [
  'case_number',
  'full_name',
  'date_of_birth',
  'home_address',
  'ssn',
  'last_utility_bill_address',
  'drivers_license_number',
  'applicant_notes',
  'reason_flagged',
  'risk_level',
  'city',
  'created_at',
  'status',
  'assigned_analyst',
  'approvable',
];

function csvEscape(value: string | number): string {
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function toCsv(cases: KycCase[]): string {
  const header = CSV_COLUMNS.join(',');
  const rows = cases.map((c) => CSV_COLUMNS.map((col) => csvEscape(c[col])).join(','));
  return [header, ...rows].join('\n') + '\n';
}

function assertConstraints(cases: KycCase[]): void {
  if (cases.length < 150) throw new Error(`expected at least 150 cases, got ${cases.length}`);
  const approvable = cases.filter((c) => c.approvable === 1);
  if (approvable.length !== APPROVABLE_CASES) {
    throw new Error(`expected exactly ${APPROVABLE_CASES} approvable cases, got ${approvable.length}`);
  }
  for (const c of cases) {
    if (!REASONS_FLAGGED.includes(c.reason_flagged)) throw new Error(`bad reason: ${c.reason_flagged}`);
    if (!ANALYSTS.includes(c.assigned_analyst)) throw new Error(`bad analyst: ${c.assigned_analyst}`);
    if (c.risk_level === 'high' && c.assigned_analyst !== 'Florence') {
      throw new Error(`high-risk case ${c.case_number} not assigned to Florence`);
    }
    if (!US_CITIES.includes(c.city as (typeof US_CITIES)[number])) throw new Error(`bad city: ${c.city}`);
    if (c.approvable === 1 && c.applicant_notes.trim().length === 0) {
      throw new Error(`approvable case ${c.case_number} is missing a justification`);
    }
  }
}

function main(): void {
  const cases = buildCases();
  assertConstraints(cases);
  const outDir = path.join(__dirname, '..', 'data');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, 'cases.csv'), toCsv(cases), 'utf8');
  const high = cases.filter((c) => c.risk_level === 'high').length;
  process.stdout.write(
    `Wrote ${cases.length} cases (${high} high risk, ${APPROVABLE_CASES} approvable) to data/cases.csv\n`,
  );
}

main();
