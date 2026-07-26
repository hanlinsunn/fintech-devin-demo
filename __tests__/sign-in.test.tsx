import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SignInForm } from '@/components/SignInForm';

const replace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: (href: string) => replace(href), refresh: jest.fn() }),
}));

beforeEach(() => {
  replace.mockClear();
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as unknown as typeof fetch;
});

describe('SignInForm', () => {
  it('offers the three analysts with their roles', () => {
    render(<SignInForm />);
    const options = screen.getAllByRole('option').map((option) => option.textContent);
    expect(options).toEqual([
      'Florence (senior analyst)',
      'Patrick (analyst)',
      'Daniel (analyst)',
    ]);
  });

  it('creates the session for the chosen analyst and enters the queue', async () => {
    render(<SignInForm />);
    await userEvent.selectOptions(screen.getByLabelText(/sign in as/i), 'Daniel');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/session',
      expect.objectContaining({ method: 'POST' }),
    );
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body).toEqual({ analyst: 'Daniel' });
    expect(replace).toHaveBeenCalledWith('/');
  });
});
