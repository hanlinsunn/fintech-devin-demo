const nextJest = require('next/jest');

const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const config = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  projects: undefined,
  testMatch: ['<rootDir>/__tests__/**/*.test.ts', '<rootDir>/__tests__/**/*.test.tsx'],
};

module.exports = async () => {
  const base = await createJestConfig(config)();
  return {
    ...base,
    testEnvironment: 'jsdom',
    // Node-only suites (SQLite, API routes) opt out of jsdom via docblock pragma.
  };
};
