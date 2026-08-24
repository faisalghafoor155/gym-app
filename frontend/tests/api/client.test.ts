import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AxiosAdapter, AxiosRequestConfig } from 'axios';

import api, { apiError, OFFLINE_WRITE_MESSAGE } from '../../src/api/client';

/**
 * The two rules the API client enforces on behalf of every page.
 *
 * Both exist for the installed app. A write attempted offline must fail
 * saying so rather than looking like the server rejected it, and a 401 that
 * arrives *because* there is no network must not sign the user out — an app
 * that opens to its cached shell only to bounce to a login screen it cannot
 * reach is worse than one that never opened.
 *
 * The transport is swapped for a stub adapter rather than mocked at the module
 * level, because the interceptors under test are installed on this very
 * instance: replacing the module would remove the thing being asserted. The
 * stub also records what reached it, which is how "refused before the request
 * was sent" is told apart from "sent and then failed".
 */

const setOnline = (value: boolean) => {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get: () => value,
  });
};

/** Requests that made it past the interceptors, in order. */
let sent: AxiosRequestConfig[];
/** `window.location.href = …` is a navigation jsdom refuses to perform. */
let assigned: string[];
const realAdapter = api.defaults.adapter;

/** Answers every request with `status`, after recording it. */
const respondWith = (status: number, data: unknown = {}) => {
  const adapter: AxiosAdapter = (config) => {
    sent.push(config);
    const response = { data, status, statusText: '', headers: {}, config };
    return status >= 200 && status < 300
      ? Promise.resolve(response)
      : Promise.reject(Object.assign(new Error(`Request failed with status code ${status}`), {
          isAxiosError: true, response, config,
        }));
  };
  api.defaults.adapter = adapter;
};

beforeEach(() => {
  sent = [];
  assigned = [];
  setOnline(true);
  respondWith(200);

  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { get href() { return '/'; }, set href(v: string) { assigned.push(v); } },
  });
});

afterEach(() => {
  api.defaults.adapter = realAdapter;
  setOnline(true);
  localStorage.clear();
});

describe('offline write guard', () => {
  it.each(['post', 'put', 'patch', 'delete'] as const)(
    'refuses %s while offline, without reaching the network',
    async (method) => {
      setOnline(false);

      await expect(api[method]('/members')).rejects.toMatchObject({
        code: 'ERR_OFFLINE_WRITE',
      });
      // The point of failing in the interceptor: nothing was sent.
      expect(sent).toHaveLength(0);
    },
  );

  it('still allows reads while offline, so cached views can try', async () => {
    setOnline(false);

    await expect(api.get('/members')).resolves.toMatchObject({ status: 200 });
    expect(sent).toHaveLength(1);
  });

  it('lets writes through once back online', async () => {
    respondWith(201, { id: 'm1' });

    await expect(api.post('/members', { name: 'Ali' })).resolves.toMatchObject({
      status: 201,
    });
    expect(sent).toHaveLength(1);
  });

  it('reports the refusal as an offline message, not the caller fallback', () => {
    // Without the special case this would read "Failed to save member", which
    // blames a save that never happened.
    expect(apiError({ code: 'ERR_OFFLINE_WRITE' }, 'Failed to save member'))
      .toBe(OFFLINE_WRITE_MESSAGE);
  });

  it('leaves ordinary server errors reporting the API message', () => {
    const err = { response: { data: { error: 'Member already exists' } } };
    expect(apiError(err, 'Failed to save member')).toBe('Member already exists');
  });
});

describe('401 handling', () => {
  it('signs the user out when the server really rejects the session', async () => {
    localStorage.setItem('user', '{}');
    respondWith(401);

    await expect(api.get('/members')).rejects.toBeTruthy();

    expect(localStorage.getItem('user')).toBeNull();
    expect(assigned).toContain('/login');
  });

  it('does not sign the user out on a 401 seen while offline', async () => {
    localStorage.setItem('user', '{}');
    setOnline(false);
    respondWith(401);

    await expect(api.get('/members')).rejects.toBeTruthy();

    // The session was never disproved — the request never got an answer worth
    // trusting, so the cached shell stays usable.
    expect(localStorage.getItem('user')).toBe('{}');
    expect(assigned).toHaveLength(0);
  });

  it('leaves the login probe alone, so the login page does not redirect itself', async () => {
    respondWith(401);

    await expect(api.post('/auth/login', {})).rejects.toBeTruthy();
    expect(assigned).toHaveLength(0);
  });
});
