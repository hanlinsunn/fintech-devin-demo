/**
 * @jest-environment node
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseCsvRecords } from '@/lib/csv';
import { ANALYSTS, REASONS_FLAGGED, RISK_LEVELS, US_CITIES } from '@/lib/domain';

const records = parseCsvRecords(
  readFileSync(path.join(process.cwd(), 'data', 'cases.csv'), 'utf8'),
);

describe('seed data integrity', () => {
  it('contains at least 150 cases with unique case numbers', () => {
    expect(records.length).toBeGreaterThanOrEqual(150);
    expect(new Set(records.map((r) => r.case_number)).size).toBe(records.length);
  });

  it('only uses the five allowed reasons flagged', () => {
    for (const record of records) {
      expect(REASONS_FLAGGED).toContain(record.reason_flagged);
    }
  });

  it('only uses medium or high risk levels', () => {
    for (const record of records) {
      expect(RISK_LEVELS).toContain(record.risk_level);
    }
  });

  it('assigns every case to Florence, Patrick, or Daniel', () => {
    for (const record of records) {
      expect(ANALYSTS).toContain(record.assigned_analyst);
    }
  });

  it('assigns every high-risk case to Florence', () => {
    const highRisk = records.filter((r) => r.risk_level === 'high');
    expect(highRisk.length).toBeGreaterThan(0);
    for (const record of highRisk) {
      expect(record.assigned_analyst).toBe('Florence');
    }
  });

  it('gives medium-risk work to Patrick and Daniel as well', () => {
    const mediumAnalysts = new Set(
      records.filter((r) => r.risk_level === 'medium').map((r) => r.assigned_analyst),
    );
    expect(mediumAnalysts).toContain('Patrick');
    expect(mediumAnalysts).toContain('Daniel');
  });

  it('uses US cities only', () => {
    for (const record of records) {
      expect(US_CITIES).toContain(record.city);
    }
  });

  it('marks exactly 50 approvable cases, each with a justification', () => {
    const approvable = records.filter((r) => r.approvable === '1');
    expect(approvable).toHaveLength(50);
    for (const record of approvable) {
      expect(record.applicant_notes.trim().length).toBeGreaterThan(20);
    }
  });

  it('populates every PII field', () => {
    for (const record of records) {
      for (const field of [
        'full_name',
        'date_of_birth',
        'home_address',
        'ssn',
        'last_utility_bill_address',
        'drivers_license_number',
        'applicant_notes',
        'created_at',
      ]) {
        expect(record[field].trim()).not.toBe('');
      }
    }
  });
});
