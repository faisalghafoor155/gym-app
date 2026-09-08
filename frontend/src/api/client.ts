import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

// Same-origin by default: locally Vite proxies /api, and in the Docker image
// nginx does. Split deployments (frontend and backend on separate hosts, as on
// Render) set VITE_API_URL at build time to the backend's origin instead.
const API_BASE_URL = (import.meta.env['VITE_API_URL'] as string | undefined) ?? '/api';

// withCredentials makes the browser send the httpOnly session cookie. The
// token is never readable from JS, so nothing is attached by hand here.
const api = axios.create({ baseURL: API_BASE_URL, withCredentials: true });

/** What a caller sees when a write is refused for being offline. */
export const OFFLINE_WRITE_MESSAGE = "You're offline. Try again when you reconnect.";

const WRITE_METHODS = ['post', 'put', 'patch', 'delete'];

/**
 * Refuses writes while offline, rather than letting them fail on their own.
 *
 * Left alone, an offline POST rejects with a network error and every call site
 * reports it as whatever its own fallback string happens to say — "Failed to
 * save member", which reads as *the save was rejected* rather than *it never
 * left the phone*. One is worth retrying; the other is worth reconnecting
 * first, and the difference matters most at a counter with a member waiting.
 *
 * Enforced here rather than at the 57-odd call sites because this also covers
 * the fifty-eighth. Reads are left to fail normally: `useFetch` already keeps
 * the previous rows on screen, which is the whole offline-shell behaviour.
 */
api.interceptors.request.use((config) => {
  const method = (config.method ?? 'get').toLowerCase();
  if (!navigator.onLine && WRITE_METHODS.includes(method)) {
    // Shaped like an axios error so `apiError` and every existing `catch`
    // handle it without knowing this rule exists.
    return Promise.reject(
      new AxiosError(
        OFFLINE_WRITE_MESSAGE,
        'ERR_OFFLINE_WRITE',
        config as InternalAxiosRequestConfig,
      ),
    );
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    const url = err.config?.url ?? '';
    // A 401 from the session probe just means "not signed in" — redirecting on
    // it would bounce a visitor off the login page they are already on.
    const isSessionProbe = url.includes('/auth/me') || url.includes('/auth/login');

    // Offline, a failed request says nothing about the session — the browser
    // never reached the server to be told otherwise. Signing the user out here
    // would take an installed app that opens to its cached shell and turn it
    // into a login screen that cannot log anyone in. The check costs nothing
    // when online: a real 401 has a response, and this branch only guards the
    // case where there is none.
    if (err.response?.status === 401 && !isSessionProbe && navigator.onLine) {
      localStorage.removeItem('user');
      localStorage.removeItem('gym');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

/** Pulls the API's `{ error }` message out of a failed request. */
export function apiError(err: unknown, fallback = 'Something went wrong'): string {
  // A write refused for being offline never reached the server, so there is no
  // `{ error }` to read and the caller's fallback would blame the save. Say
  // what actually happened instead.
  if ((err as AxiosError)?.code === 'ERR_OFFLINE_WRITE') return OFFLINE_WRITE_MESSAGE;

  const message = (err as AxiosError<{ error?: string }>)?.response?.data?.error;
  return message ?? fallback;
}

export default api;
