import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { mockApi, renderPage } from '../helpers';

/**
 * Signing in, including the second factor.
 *
 * The one screen nobody can work around: a regression here locks the whole gym
 * out, and 2FA makes it the most stateful page in the app — the password step
 * does not sign anyone in, it hands back a challenge that the code step spends.
 *
 * What is asserted is the request. The challenge token is the thing that must
 * travel from the first call to the second, and a page that dropped it, or
 * called `/auth/login` again with the code in it, would look identical on
 * screen while being unable to sign anyone in.
 */

const api = vi.hoisted(() => ({ current: null as ReturnType<typeof import('../helpers')['mockApi']> | null }));
const login = vi.hoisted(() => vi.fn());
const navigate = vi.hoisted(() => vi.fn());

vi.mock('../../src/api/client', () => ({
  default: {
    get: (url: string) => api.current!.get(url),
    post: (...args: unknown[]) => api.current!.post(...args as []),
    put: (...args: unknown[]) => api.current!.put(...args as []),
    delete: (...args: unknown[]) => api.current!.delete(...args as []),
  },
  apiError: (_e: unknown, fallback = 'Something went wrong') => fallback,
}));

vi.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({ login }),
}));

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<typeof import('react-router-dom')>('react-router-dom')),
  useNavigate: () => navigate,
}));

vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

// Google sign-in loads a remote script and is not what these tests are about.
vi.mock('../../src/components/GoogleSignIn', () => ({ default: () => null }));

const Login = (await import('../../src/pages/Login')).default;

const session = {
  user: { id: 'u1', name: 'Owner', role: 'owner' },
  gym: { id: 'g1', name: 'Fitness Plus' },
};

/** Fills in the password step and submits it. */
const signIn = async (post: ReturnType<typeof vi.fn>) => {
  api.current = { ...mockApi({}), post: post as ReturnType<typeof mockApi>['post'] };
  renderPage(<Login />);
  await userEvent.type(screen.getByPlaceholderText(/owner@gym.com/i), 'owner@gym.com');
  await userEvent.type(screen.getByPlaceholderText('••••••••'), 'hunter2hunter2');
  await userEvent.click(screen.getByRole('button', { name: /^sign in$/i }));
};

describe('Login — the password step', () => {
  it('sends what was typed to /auth/login', async () => {
    const post = vi.fn(() => Promise.resolve({ data: session }));

    await signIn(post);

    await waitFor(() => expect(post).toHaveBeenCalledWith('/auth/login', {
      email: 'owner@gym.com',
      password: 'hunter2hunter2',
    }));
  });

  it('signs in when the account has no second factor', async () => {
    const post = vi.fn(() => Promise.resolve({ data: session }));

    await signIn(post);

    await waitFor(() => expect(login).toHaveBeenCalledWith(session.user, session.gym));
    expect(navigate).toHaveBeenCalledWith('/dashboard');
  });

  it('does not sign anyone in on a challenge', async () => {
    login.mockClear();
    const post = vi.fn(() => Promise.resolve({
      data: { requiresTwoFactor: true, twoFactorToken: 'challenge-abc' },
    }));

    await signIn(post);

    // The challenge is not a session. Treating it as one is the bug that
    // would let the password alone through and make 2FA decorative.
    await screen.findByRole('button', { name: /verify/i });
    expect(login).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('Login — the second factor', () => {
  /** Gets to the code step with a known challenge token. */
  const reachCodeStep = async () => {
    login.mockClear();
    navigate.mockClear();
    const post = vi.fn()
      .mockResolvedValueOnce({
        data: { requiresTwoFactor: true, twoFactorToken: 'challenge-abc' },
      })
      .mockResolvedValueOnce({ data: session });

    await signIn(post);
    await screen.findByRole('button', { name: /verify/i });
    return post;
  };

  it('spends the challenge token with the authenticator code', async () => {
    const post = await reachCodeStep();

    await userEvent.type(screen.getByPlaceholderText('123456'), '123456');
    await userEvent.click(screen.getByRole('button', { name: /verify/i }));

    await waitFor(() => expect(post).toHaveBeenLastCalledWith(
      '/auth/two-factor/verify-login',
      // The token from the first response, not the password again — this pair
      // is the entire contract of the second step.
      { token: 'challenge-abc', code: '123456' },
    ));
  });

  it('accepts a backup code in place of the authenticator', async () => {
    const post = await reachCodeStep();

    await userEvent.type(screen.getByPlaceholderText('123456'), '1234-5678');
    await userEvent.click(screen.getByRole('button', { name: /verify/i }));

    // Sent through unchanged: the server decides by shape, and a page that
    // stripped the dash would lock out anyone who had lost their phone —
    // precisely the people backup codes exist for.
    await waitFor(() => expect(post).toHaveBeenLastCalledWith(
      '/auth/two-factor/verify-login',
      { token: 'challenge-abc', code: '1234-5678' },
    ));
  });

  it('signs in once the code is accepted', async () => {
    await reachCodeStep();

    await userEvent.type(screen.getByPlaceholderText('123456'), '123456');
    await userEvent.click(screen.getByRole('button', { name: /verify/i }));

    await waitFor(() => expect(login).toHaveBeenCalledWith(session.user, session.gym));
    expect(navigate).toHaveBeenCalledWith('/dashboard');
  });

  it('goes back to the password step, abandoning the challenge', async () => {
    await reachCodeStep();

    await userEvent.click(screen.getByRole('button', { name: /back to sign in/i }));

    expect(screen.getByPlaceholderText(/owner@gym.com/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /verify/i })).not.toBeInTheDocument();
  });
});
