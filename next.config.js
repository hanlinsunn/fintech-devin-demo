/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // better-sqlite3 is a native module and must stay external to the server bundle.
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3'],
    // The seed CSV is read at runtime, so tracing must bundle it with the server output.
    outputFileTracingIncludes: {
      '/api/**': ['./data/cases.csv'],
      '/': ['./data/cases.csv'],
      '/cases/[caseNumber]': ['./data/cases.csv'],
    },
  },
};

module.exports = nextConfig;
