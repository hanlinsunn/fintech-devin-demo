import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CaseQueue } from '@/components/CaseQueue';
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

  it('sorts by risk level when the header is clicked', async () => {
    render(<CaseQueue cases={CASES} />);
    await userEvent.click(screen.getByRole('button', { name: /risk level/i }));
    const firstRow = screen.getAllByRole('row')[1];
    expect(within(firstRow).getByText('high')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /risk level/i }));
    const firstRowAsc = screen.getAllByRole('row')[1];
    expect(within(firstRowAsc).getByText('medium')).toBeInTheDocument();
  });

  it('sorts by age of request, defaulting to the oldest requests first', async () => {
    render(<CaseQueue cases={CASES} />);
    expect(screen.getAllByRole('row')[1]).toHaveTextContent('KYC-0002');

    await userEvent.click(screen.getByRole('button', { name: /age of request/i }));
    expect(screen.getAllByRole('row')[1]).toHaveTextContent('KYC-0003');

    await userEvent.click(screen.getByRole('button', { name: /age of request/i }));
    expect(screen.getAllByRole('row')[1]).toHaveTextContent('KYC-0002');
  });

  it('sorts by status', async () => {
    render(<CaseQueue cases={CASES} />);
    await userEvent.click(screen.getByRole('button', { name: /^status$/i }));
    expect(screen.getAllByRole('row')[1]).toHaveTextContent('pending review');
  });

  it('renders an empty-queue state', () => {
    render(<CaseQueue cases={[]} />);
    expect(screen.getByText(/review queue is empty/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
