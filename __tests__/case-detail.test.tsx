import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CaseDetail } from '@/components/CaseDetail';
import { formatAge, maskSsn, type CaseAction } from '@/lib/domain';
import { daysAgo, makeCase } from './helpers/fixtures';

const refresh = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => refresh() }) }));

const KYC_CASE = makeCase({
  case_number: 'KYC-0042',
  full_name: 'Elena Brennan',
  date_of_birth: '1991-11-30',
  home_address: '77 Cedar Ln, Seattle, WA 98101',
  ssn: '553-21-8844',
  last_utility_bill_address: '77 Cedar Ln, Seattle, WA 98101',
  drivers_license_number: 'WA-9931882',
  applicant_notes: 'Legal name change after marriage with supporting documentation provided.',
  city: 'Seattle',
  assigned_analyst: 'Florence',
});

const ACTIONS: CaseAction[] = [
  {
    id: 1,
    case_number: 'KYC-0042',
    action: 'request_docs',
    comment: 'Requested the marriage certificate',
    analyst: 'Florence',
    created_at: '2024-09-01T10:00:00.000Z',
  },
];

beforeEach(() => {
  refresh.mockClear();
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ case: KYC_CASE, action: ACTIONS[0] }),
  }) as unknown as typeof fetch;
});

describe('CaseDetail', () => {
  it('shows every PII field, the notes, and the city', () => {
    render(<CaseDetail kycCase={KYC_CASE} actions={ACTIONS} sessionAnalyst="Florence" />);
    expect(screen.getByText('1991-11-30')).toBeInTheDocument();
    expect(screen.getAllByText('77 Cedar Ln, Seattle, WA 98101')).toHaveLength(2);
    expect(screen.getByText('WA-9931882')).toBeInTheDocument();
    expect(screen.getByText(/legal name change after marriage/i)).toBeInTheDocument();
    expect(screen.getByText('Seattle')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /KYC-0042 — Elena Brennan/ })).toBeInTheDocument();
  });

  it('shows the SSN unmasked, unlike the queue', () => {
    render(<CaseDetail kycCase={KYC_CASE} actions={ACTIONS} sessionAnalyst="Florence" />);
    expect(screen.getByText('553-21-8844')).toBeInTheDocument();
    expect(screen.queryByText(maskSsn(KYC_CASE.ssn))).not.toBeInTheDocument();
  });

  it('lists the existing audit log entries', () => {
    render(<CaseDetail kycCase={KYC_CASE} actions={ACTIONS} sessionAnalyst="Florence" />);
    expect(screen.getByText('Requested the marriage certificate')).toBeInTheDocument();
    expect(screen.getByText(/request_docs · Florence/)).toBeInTheDocument();
  });

  it('shows the case attributes as pills', () => {
    const kycCase = makeCase({
      reason_flagged: 'sanctions watchlist',
      risk_level: 'high',
      status: 'docs_requested',
      created_at: daysAgo(78),
    });
    render(<CaseDetail kycCase={kycCase} actions={[]} sessionAnalyst="Florence" />);

    const pills = within(screen.getByRole('list', { name: 'Case attributes' })).getAllByRole(
      'listitem',
    );
    expect(pills.map((pill) => pill.textContent)).toEqual([
      'sanctions watchlist',
      'high risk',
      'docs requested',
      `open ${formatAge(kycCase.created_at)}`,
    ]);
    // Each pill has to size to its own text rather than clip it.
    for (const pill of pills) {
      expect(pill).toHaveClass('whitespace-nowrap');
      expect(pill.className).not.toMatch(/truncate|overflow-hidden|w-\d/);
    }
  });

  it.each([
    { risk: 'high' as const, tone: 'bg-red-50', otherTone: 'bg-amber-50' },
    { risk: 'medium' as const, tone: 'bg-amber-50', otherTone: 'bg-red-50' },
  ])('tints the $risk risk pill without keeping the neutral colours', ({ risk, tone, otherTone }) => {
    render(
      <CaseDetail kycCase={makeCase({ risk_level: risk })} actions={[]} sessionAnalyst="Florence" />,
    );
    const pill = screen.getByText(`${risk} risk`);

    expect(pill).toHaveClass(tone);
    expect(pill).not.toHaveClass(otherTone);
    // A neutral class left alongside the tone wins on Tailwind source order, so the pill renders grey.
    expect(pill).not.toHaveClass('bg-slate-100');
    expect(pill).not.toHaveClass('text-slate-700');
    expect(pill).not.toHaveClass('border-slate-200');
  });

  it('defaults the action dropdown to no selection', () => {
    render(<CaseDetail kycCase={KYC_CASE} actions={ACTIONS} sessionAnalyst="Florence" />);
    const select = screen.getByLabelText('Action') as HTMLSelectElement;
    expect(select.value).toBe('');
    expect(screen.getByRole('option', { name: 'Select an action…' }).getAttribute('value')).toBe('');
  });

  it('keeps submit disabled until both an action and a non-empty comment are entered', async () => {
    render(<CaseDetail kycCase={KYC_CASE} actions={ACTIONS} sessionAnalyst="Florence" />);
    const submit = screen.getByRole('button', { name: /submit action/i });
    expect(submit).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/comment/i), '   ');
    expect(submit).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/comment/i), 'Verified against the court order');
    // Comment alone is not enough while no action is chosen.
    expect(submit).toBeDisabled();

    await userEvent.selectOptions(screen.getByLabelText('Action'), 'approve');
    expect(submit).toBeEnabled();
  });

  it('clears the chosen action after a successful submit', async () => {
    render(<CaseDetail kycCase={KYC_CASE} actions={ACTIONS} sessionAnalyst="Florence" />);
    await userEvent.selectOptions(screen.getByLabelText('Action'), 'escalate');
    await userEvent.type(screen.getByLabelText(/comment/i), 'Escalating to the sanctions desk');
    await userEvent.click(screen.getByRole('button', { name: /submit action/i }));

    expect(await screen.findByRole('status')).toBeInTheDocument();
    expect((screen.getByLabelText('Action') as HTMLSelectElement).value).toBe('');
    expect(screen.getByRole('button', { name: /submit action/i })).toBeDisabled();
  });

  it('posts the action and comment, then refreshes', async () => {
    render(<CaseDetail kycCase={KYC_CASE} actions={ACTIONS} sessionAnalyst="Florence" />);
    await userEvent.selectOptions(screen.getByLabelText('Action'), 'approve');
    await userEvent.type(screen.getByLabelText(/comment/i), 'Documents verified');
    await userEvent.click(screen.getByRole('button', { name: /submit action/i }));

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/cases/KYC-0042/actions',
      expect.objectContaining({ method: 'POST' }),
    );
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body).toEqual({ action: 'approve', comment: 'Documents verified' });
    expect(refresh).toHaveBeenCalled();
  });

  it('shows the assigned analyst as a read-only acting analyst', () => {
    render(<CaseDetail kycCase={KYC_CASE} actions={ACTIONS} sessionAnalyst="Florence" />);
    expect(screen.queryByLabelText('Acting analyst')).not.toBeInTheDocument();
    expect(screen.getAllByText('Florence').length).toBeGreaterThan(0);
  });

  it('blocks and explains actions on another analyst’s case', () => {
    render(<CaseDetail kycCase={KYC_CASE} actions={ACTIONS} sessionAnalyst="Daniel" />);

    expect(screen.getByLabelText('Action')).toBeDisabled();
    expect(screen.getByLabelText(/comment/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /submit action/i })).toBeDisabled();
    expect(screen.getByRole('tooltip')).toHaveTextContent('Not authorized to take this action');
    expect(screen.getByRole('alert')).toHaveTextContent('Not authorized to take this action');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('includes the target analyst when reassigning', async () => {
    render(<CaseDetail kycCase={KYC_CASE} actions={ACTIONS} sessionAnalyst="Florence" />);
    await userEvent.selectOptions(screen.getByLabelText('Action'), 'reassign');
    await userEvent.selectOptions(screen.getByLabelText('Reassign to'), 'Patrick');
    await userEvent.type(screen.getByLabelText(/comment/i), 'Patrick owns this region');
    await userEvent.click(screen.getByRole('button', { name: /submit action/i }));

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body).toMatchObject({ action: 'reassign', assignTo: 'Patrick' });
  });

  it('surfaces an API error to the analyst', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'A comment is required' }),
    }) as unknown as typeof fetch;

    render(<CaseDetail kycCase={KYC_CASE} actions={ACTIONS} sessionAnalyst="Florence" />);
    await userEvent.selectOptions(screen.getByLabelText('Action'), 'approve');
    await userEvent.type(screen.getByLabelText(/comment/i), 'x');
    await userEvent.click(screen.getByRole('button', { name: /submit action/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('A comment is required');
    expect(refresh).not.toHaveBeenCalled();
  });
});
