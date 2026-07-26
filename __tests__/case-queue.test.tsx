import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CaseQueue } from '@/components/CaseQueue';
import { formatAge, maskSsn } from '@/lib/domain';
import { daysAgo, makeCase } from './helpers/fixtures';

const CASES = [
  makeCase({
    case_number: 'KYC-0001',
    full_name: 'Alice Whitaker',
    risk_level: 'medium',
    status: 'pending_review',
    city: 'Denver',
    assigned_analyst: 'Patrick',
    created_at: daysAgo(3),
  }),
  makeCase({
    case_number: 'KYC-0002',
    full_name: 'Marcus Okafor',
    risk_level: 'high',
    status: 'escalated',
    reason_flagged: 'sanctions watchlist',
    city: 'Chicago',
    assigned_analyst: 'Florence',
    ssn: '221-45-9080',
    created_at: daysAgo(12),
  }),
  makeCase({
    case_number: 'KYC-0003',
    full_name: 'Priya Nakamura',
    risk_level: 'medium',
    status: 'approved',
    reason_flagged: 'document issues',
    city: 'Austin',
    assigned_analyst: 'Daniel',
    created_at: daysAgo(1),
  }),
];

/**
 * Expected orders per column. KYC-0001 and KYC-0003 share the fixture SSN and risk level,
 * so those orders also assert that ties keep the default queue order (stable sort).
 */
const SORTABLE_COLUMNS = [
  { label: 'Case number', ascending: ['KYC-0001', 'KYC-0002', 'KYC-0003'], descending: ['KYC-0003', 'KYC-0002', 'KYC-0001'] },
  { label: 'Full name', ascending: ['KYC-0001', 'KYC-0002', 'KYC-0003'], descending: ['KYC-0003', 'KYC-0002', 'KYC-0001'] },
  { label: 'SSN', ascending: ['KYC-0002', 'KYC-0001', 'KYC-0003'], descending: ['KYC-0001', 'KYC-0003', 'KYC-0002'] },
  { label: 'Reason flagged', ascending: ['KYC-0001', 'KYC-0003', 'KYC-0002'], descending: ['KYC-0002', 'KYC-0003', 'KYC-0001'] },
  { label: 'Risk level', ascending: ['KYC-0001', 'KYC-0003', 'KYC-0002'], descending: ['KYC-0002', 'KYC-0001', 'KYC-0003'] },
  { label: 'Age of request', ascending: ['KYC-0003', 'KYC-0001', 'KYC-0002'], descending: ['KYC-0002', 'KYC-0001', 'KYC-0003'] },
  { label: 'Status', ascending: ['KYC-0003', 'KYC-0002', 'KYC-0001'], descending: ['KYC-0001', 'KYC-0002', 'KYC-0003'] },
  { label: 'Assigned analyst', ascending: ['KYC-0003', 'KYC-0002', 'KYC-0001'], descending: ['KYC-0001', 'KYC-0002', 'KYC-0003'] },
  { label: 'City', ascending: ['KYC-0003', 'KYC-0002', 'KYC-0001'], descending: ['KYC-0001', 'KYC-0002', 'KYC-0003'] },
];

function labelPattern(label: string): RegExp {
  return new RegExp(`^${label}$`, 'i');
}

function headerFor(label: string) {
  return screen.getByRole('columnheader', { name: labelPattern(label) });
}

function caseOrder(): string[] {
  return screen.getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell')[0].textContent!);
}

function rowFor(caseNumber: string) {
  return screen.getByRole('link', { name: caseNumber }).closest('tr')!;
}

describe('CaseQueue', () => {
  it('renders every required column', () => {
    render(<CaseQueue cases={CASES} />);
    for (const header of [
      'Case number',
      'Full name',
      'SSN',
      'Reason flagged',
      'Risk level',
      'Age of request',
      'Status',
      'Assigned analyst',
      'City',
    ]) {
      expect(screen.getByRole('columnheader', { name: new RegExp(header, 'i') })).toBeInTheDocument();
    }
  });

  it('shows case data including the city', () => {
    render(<CaseQueue cases={CASES} />);
    const row = rowFor('KYC-0002');
    expect(within(row).getByText('Marcus Okafor')).toBeInTheDocument();
    expect(within(row).getByText('sanctions watchlist')).toBeInTheDocument();
    expect(within(row).getByText('high')).toBeInTheDocument();
    expect(within(row).getByText('Chicago')).toBeInTheDocument();
    expect(within(row).getByText('Florence')).toBeInTheDocument();
  });

  it('masks the SSN', () => {
    render(<CaseQueue cases={CASES} />);
    expect(within(rowFor('KYC-0002')).getByText('***-**-9080')).toBeInTheDocument();
    expect(screen.queryByText('221-45-9080')).not.toBeInTheDocument();
  });

  it('computes the age of each request from created_at', () => {
    render(<CaseQueue cases={CASES} />);
    expect(within(rowFor('KYC-0001')).getByText('3 days')).toBeInTheDocument();
    expect(within(rowFor('KYC-0002')).getByText('12 days')).toBeInTheDocument();
    expect(within(rowFor('KYC-0003')).getByText('1 day')).toBeInTheDocument();
  });

  it('filters by risk level', async () => {
    render(<CaseQueue cases={CASES} />);
    await userEvent.selectOptions(screen.getByLabelText('Risk level'), 'high');
    expect(screen.getByRole('link', { name: 'KYC-0002' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'KYC-0001' })).not.toBeInTheDocument();
    expect(screen.getByTestId('result-count')).toHaveTextContent('1 of 3 cases');
  });

  it('filters by status', async () => {
    render(<CaseQueue cases={CASES} />);
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'approved');
    expect(screen.getByRole('link', { name: 'KYC-0003' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'KYC-0002' })).not.toBeInTheDocument();
  });

  it('combines the risk and status filters', async () => {
    render(<CaseQueue cases={CASES} />);
    await userEvent.selectOptions(screen.getByLabelText('Risk level'), 'high');
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'approved');
    expect(screen.getByText('No cases match the selected filters.')).toBeInTheDocument();
  });

  it('renders every column in the default (unsorted) queue order', () => {
    render(<CaseQueue cases={CASES} />);
    expect(caseOrder()).toEqual(['KYC-0001', 'KYC-0002', 'KYC-0003']);
    for (const { label } of SORTABLE_COLUMNS) {
      expect(headerFor(label)).toHaveAttribute('aria-sort', 'none');
    }
  });

  it.each(SORTABLE_COLUMNS)(
    'cycles $label through ascending, descending, and back to the default order',
    async ({ label, ascending, descending }) => {
      render(<CaseQueue cases={CASES} />);
      const header = screen.getByRole('button', { name: labelPattern(label) });

      await userEvent.click(header);
      expect(caseOrder()).toEqual(ascending);
      expect(headerFor(label)).toHaveAttribute('aria-sort', 'ascending');

      await userEvent.click(header);
      expect(caseOrder()).toEqual(descending);
      expect(headerFor(label)).toHaveAttribute('aria-sort', 'descending');

      await userEvent.click(header);
      expect(caseOrder()).toEqual(['KYC-0001', 'KYC-0002', 'KYC-0003']);
      expect(headerFor(label)).toHaveAttribute('aria-sort', 'none');
    },
  );

  it('sorts only one column at a time', async () => {
    render(<CaseQueue cases={CASES} />);
    await userEvent.click(screen.getByRole('button', { name: labelPattern('City') }));
    await userEvent.click(screen.getByRole('button', { name: labelPattern('Full name') }));

    expect(headerFor('City')).toHaveAttribute('aria-sort', 'none');
    expect(headerFor('Full name')).toHaveAttribute('aria-sort', 'ascending');
    expect(caseOrder()).toEqual(['KYC-0001', 'KYC-0002', 'KYC-0003']);
  });

  it('keeps every row internally consistent while sorted', async () => {
    render(<CaseQueue cases={CASES} />);
    await userEvent.click(screen.getByRole('button', { name: labelPattern('City') }));

    for (const kycCase of CASES) {
      const cells = within(rowFor(kycCase.case_number)).getAllByRole('cell');
      expect(cells.map((cell) => cell.textContent)).toEqual([
        kycCase.case_number,
        kycCase.full_name,
        maskSsn(kycCase.ssn),
        kycCase.reason_flagged,
        kycCase.risk_level,
        formatAge(kycCase.created_at),
        kycCase.status.replace(/_/g, ' '),
        kycCase.assigned_analyst,
        kycCase.city,
      ]);
    }
  });

  it('keeps sorting applied to the filtered subset', async () => {
    render(<CaseQueue cases={CASES} />);
    await userEvent.selectOptions(screen.getByLabelText('Risk level'), 'medium');
    await userEvent.click(screen.getByRole('button', { name: labelPattern('City') }));
    expect(caseOrder()).toEqual(['KYC-0003', 'KYC-0001']);
  });

  it('renders an empty-queue state', () => {
    render(<CaseQueue cases={[]} />);
    expect(screen.getByText(/review queue is empty/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('CaseQueue pagination', () => {
  // 60 cases: 3 pages of 25, with names/risk that make cross-page sorting checkable.
  const MANY = Array.from({ length: 60 }, (_, i) =>
    makeCase({
      case_number: `KYC-${1000 + i}`,
      full_name: `Analyst Case ${String(i).padStart(2, '0')}`,
      risk_level: i === 59 ? 'high' : 'medium',
      created_at: daysAgo(i),
    }),
  );

  function nextButton() {
    return screen.getByRole('button', { name: 'Next' });
  }

  function previousButton() {
    return screen.getByRole('button', { name: 'Previous' });
  }

  it('shows 25 rows per page', () => {
    render(<CaseQueue cases={MANY} />);
    expect(caseOrder()).toHaveLength(25);
    expect(caseOrder()[0]).toBe('KYC-1000');
    expect(screen.getByTestId('page-indicator')).toHaveTextContent('Page 1 of 3');
    expect(screen.getByTestId('page-range')).toHaveTextContent('Showing 1–25 of 60');
    expect(screen.getByTestId('result-count')).toHaveTextContent('60 of 60 cases');
  });

  it('pages forward and back through the queue', async () => {
    render(<CaseQueue cases={MANY} />);
    expect(previousButton()).toBeDisabled();

    await userEvent.click(nextButton());
    expect(caseOrder()[0]).toBe('KYC-1025');
    expect(screen.getByTestId('page-range')).toHaveTextContent('Showing 26–50 of 60');

    await userEvent.click(nextButton());
    expect(caseOrder()).toHaveLength(10);
    expect(screen.getByTestId('page-range')).toHaveTextContent('Showing 51–60 of 60');
    expect(nextButton()).toBeDisabled();

    await userEvent.click(previousButton());
    expect(caseOrder()[0]).toBe('KYC-1025');
  });

  it('sorts across the whole queue, not just the current page', async () => {
    render(<CaseQueue cases={MANY} />);
    await userEvent.click(screen.getByRole('button', { name: labelPattern('Full name') }));
    expect(caseOrder()[0]).toBe('KYC-1000');

    await userEvent.click(screen.getByRole('button', { name: labelPattern('Full name') }));
    // Descending must surface the last case of the queue on page 1.
    expect(caseOrder()[0]).toBe('KYC-1059');
  });

  it('returns to the first page when sorting or filtering changes', async () => {
    render(<CaseQueue cases={MANY} />);
    await userEvent.click(nextButton());
    expect(screen.getByTestId('page-indicator')).toHaveTextContent('Page 2 of 3');

    await userEvent.click(screen.getByRole('button', { name: labelPattern('City') }));
    expect(screen.getByTestId('page-indicator')).toHaveTextContent('Page 1 of 3');

    await userEvent.click(nextButton());
    await userEvent.selectOptions(screen.getByLabelText('Risk level'), 'high');
    expect(screen.getByTestId('page-indicator')).toHaveTextContent('Page 1 of 1');
    expect(caseOrder()).toEqual(['KYC-1059']);
  });

  it('keeps a single page for a queue smaller than the page size', () => {
    render(<CaseQueue cases={CASES} />);
    expect(screen.getByTestId('page-indicator')).toHaveTextContent('Page 1 of 1');
    expect(nextButton()).toBeDisabled();
    expect(previousButton()).toBeDisabled();
  });
});
