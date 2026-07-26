/**
 * Owns all SQLite access for the KYC review queue.
 *
 * Nothing outside this module talks to `better-sqlite3` directly. The database
 * file is created and seeded from `data/cases.csv` the first time it is opened.
 */
import Database from 'better-sqlite3';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { parseCsvRecords } from './csv';
import {
  ACTION_TO_STATUS,
  CASE_ACTIONS,
  MAX_COMMENT_LENGTH,
  type CaseAction,
  type CaseActionType,
  type KycCase,
} from './domain';

export class CaseNotFoundError extends Error {
  constructor(caseNumber: string) {
    super(`Case ${caseNumber} does not exist`);
    this.name = 'CaseNotFoundError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS cases (
  case_number TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  date_of_birth TEXT NOT NULL,
  home_address TEXT NOT NULL,
  ssn TEXT NOT NULL,
  last_utility_bill_address TEXT NOT NULL,
  drivers_license_number TEXT NOT NULL,
  applicant_notes TEXT NOT NULL,
  reason_flagged TEXT NOT NULL CHECK (reason_flagged IN (
    'identity mismatch','address mismatch','document issues','sanctions watchlist','duplicate request'
  )),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('medium','high')),
  city TEXT NOT NULL,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'pending_review','approved','rejected','docs_requested','escalated','reassigned'
  )),
  assigned_analyst TEXT NOT NULL,
  approvable INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS case_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_number TEXT NOT NULL REFERENCES cases(case_number),
  action TEXT NOT NULL CHECK (action IN ('approve','reject','request_docs','escalate','reassign')),
  comment TEXT NOT NULL CHECK (length(trim(comment)) > 0),
  analyst TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_case_actions_case_number ON case_actions(case_number);
`;

export interface RecordActionInput {
  caseNumber: string;
  action: CaseActionType;
  comment: string;
  /** Acting analyst identity, threaded from the UI through the API into the audit log. */
  analyst: string;
  /** Required for `reassign`: the analyst the case is being handed to. */
  assignTo?: string;
}

export const DEFAULT_DB_PATH = path.join(process.cwd(), 'data', 'kyc.db');
export const DEFAULT_SEED_CSV_PATH = path.join(process.cwd(), 'data', 'cases.csv');

let db: Database.Database | null = null;

function dbPath(): string {
  return process.env.KYC_DB_PATH ?? DEFAULT_DB_PATH;
}

function seedCsvPath(): string {
  return process.env.KYC_SEED_CSV ?? DEFAULT_SEED_CSV_PATH;
}

/** Creates the schema and, when the `cases` table is empty, seeds it from the CSV. */
export function initialize(connection: Database.Database, csvPath = seedCsvPath()): void {
  connection.pragma('foreign_keys = ON');
  connection.exec(SCHEMA);
  const { count } = connection.prepare('SELECT COUNT(*) AS count FROM cases').get() as {
    count: number;
  };
  if (count > 0) return;
  if (!existsSync(csvPath)) {
    throw new Error(`Seed file not found at ${csvPath}`);
  }
  const records = parseCsvRecords(readFileSync(csvPath, 'utf8'));
  const insert = connection.prepare(`
    INSERT INTO cases (
      case_number, full_name, date_of_birth, home_address, ssn, last_utility_bill_address,
      drivers_license_number, applicant_notes, reason_flagged, risk_level, city, created_at,
      status, assigned_analyst, approvable
    ) VALUES (
      @case_number, @full_name, @date_of_birth, @home_address, @ssn, @last_utility_bill_address,
      @drivers_license_number, @applicant_notes, @reason_flagged, @risk_level, @city, @created_at,
      @status, @assigned_analyst, @approvable
    )
  `);
  const seed = connection.transaction((rows: Record<string, string>[]) => {
    for (const row of rows) {
      insert.run({ ...row, approvable: Number(row.approvable) === 1 ? 1 : 0 });
    }
  });
  seed(records);
}

/** Returns the process-wide connection, creating and seeding the database if needed. */
export function getDb(): Database.Database {
  if (db) return db;
  const file = dbPath();
  mkdirSync(path.dirname(file), { recursive: true });
  const connection = new Database(file);
  initialize(connection);
  db = connection;
  return db;
}

/** Closes the cached connection. Used by tests and to simulate a server restart. */
export function closeDb(): void {
  db?.close();
  db = null;
}

export function listCases(): KycCase[] {
  return getDb()
    .prepare('SELECT * FROM cases ORDER BY created_at DESC')
    .all() as KycCase[];
}

export function getCase(caseNumber: string): KycCase | undefined {
  return getDb().prepare('SELECT * FROM cases WHERE case_number = ?').get(caseNumber) as
    | KycCase
    | undefined;
}

export function listCaseActions(caseNumber: string): CaseAction[] {
  return getDb()
    .prepare('SELECT * FROM case_actions WHERE case_number = ? ORDER BY id ASC')
    .all(caseNumber) as CaseAction[];
}

function validate(input: RecordActionInput): void {
  if (!CASE_ACTIONS.includes(input.action)) {
    throw new ValidationError(`Unknown action: ${String(input.action)}`);
  }
  if (typeof input.comment !== 'string' || input.comment.trim().length === 0) {
    throw new ValidationError('A comment is required');
  }
  if (input.comment.length > MAX_COMMENT_LENGTH) {
    throw new ValidationError(`Comment must be ${MAX_COMMENT_LENGTH} characters or fewer`);
  }
  if (typeof input.analyst !== 'string' || input.analyst.trim().length === 0) {
    throw new ValidationError('An acting analyst is required');
  }
  if (input.action === 'reassign' && !input.assignTo?.trim()) {
    throw new ValidationError('Reassign requires the analyst to assign the case to');
  }
}

export interface RecordActionResult {
  case: KycCase;
  action: CaseAction;
}

/**
 * Appends an audit row and moves the case to the action's status in one transaction.
 * `reassign` additionally updates `cases.assigned_analyst`. Existing `case_actions`
 * rows are never modified.
 */
export function recordAction(input: RecordActionInput): RecordActionResult {
  validate(input);
  const connection = getDb();
  const run = connection.transaction((): RecordActionResult => {
    const existing = connection
      .prepare('SELECT case_number FROM cases WHERE case_number = ?')
      .get(input.caseNumber);
    if (!existing) throw new CaseNotFoundError(input.caseNumber);

    const createdAt = new Date().toISOString();
    const insert = connection
      .prepare(
        `INSERT INTO case_actions (case_number, action, comment, analyst, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(input.caseNumber, input.action, input.comment.trim(), input.analyst, createdAt);

    const status = ACTION_TO_STATUS[input.action];
    if (input.action === 'reassign') {
      connection
        .prepare('UPDATE cases SET status = ?, assigned_analyst = ? WHERE case_number = ?')
        .run(status, input.assignTo!.trim(), input.caseNumber);
    } else {
      connection
        .prepare('UPDATE cases SET status = ? WHERE case_number = ?')
        .run(status, input.caseNumber);
    }

    const updated = connection
      .prepare('SELECT * FROM cases WHERE case_number = ?')
      .get(input.caseNumber) as KycCase;
    const action = connection
      .prepare('SELECT * FROM case_actions WHERE id = ?')
      .get(insert.lastInsertRowid) as CaseAction;
    return { case: updated, action };
  });
  return run();
}
