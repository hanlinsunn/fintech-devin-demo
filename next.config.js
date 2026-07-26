/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // The seed CSV is read at runtime, so tracing must bundle it with the server output.
    outputFileTracingIncludes: {
      '/api/**': ['./data/cases.csv'],
      '/': ['./data/cases.csv'],
      '/cases/[caseNumber]': ['./data/cases.csv'],
    },
  },
};

module.exports = nextConfig;
