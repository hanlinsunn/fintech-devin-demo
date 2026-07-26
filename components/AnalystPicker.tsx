'use client';

import { ANALYSTS } from '@/lib/domain';

/**
 * Picks the acting analyst. There is no auth in the prototype, so this value is the
 * identity that flows into the API request and onto every audit row.
 */
export function AnalystPicker({
  value,
  onChange,
  label = 'Acting analyst',
  id = 'acting-analyst',
}: {
  value: string;
  onChange: (analyst: string) => void;
  label?: string;
  id?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
      >
        {ANALYSTS.map((analyst) => (
          <option key={analyst} value={analyst}>
            {analyst}
          </option>
        ))}
      </select>
    </div>
  );
}
