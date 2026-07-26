import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Points the data layer at a throwaway SQLite file. Must be called before
 * `lib/db` is imported so the module reads the overridden path.
 */
export function useTempDb(): { dir: string; file: string; cleanup: () => void } {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'kyc-test-'));
  const file = path.join(dir, 'kyc.db');
  process.env.KYC_DB_PATH = file;
  delete process.env.TURSO_DATABASE_URL;
  delete process.env.TURSO_AUTH_TOKEN;
  return {
    dir,
    file,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}
