import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'KYC Review Queue',
  description: 'Internal compliance tool for reviewing flagged customer applications',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-[1800px] items-center justify-between px-6 py-4">
            <Link href="/" className="text-lg font-semibold">
              KYC Review Queue
            </Link>
            <span className="text-xs text-slate-500">
              Demo environment — all PII shown is fake
            </span>
          </div>
        </header>
        <main className="mx-auto max-w-[1800px] px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
