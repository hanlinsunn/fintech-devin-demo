'use client';

import { ANALYSTS } from '@/lib/domain';

/** Picks an analyst from the roster, used for choosing the target of a reassign. */
export function AnalystPicker({
  value,
  onChange,
  label = 'Acting analyst',
  id = 'acting-analyst',
  disabled = false,
}: {
  value: string;
  onChange: (analyst: string) => void;
  label?: string;
  id?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="rounded border border-slate-300 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
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
