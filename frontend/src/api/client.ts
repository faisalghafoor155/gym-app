import axios, { AxiosError } from 'axios';

// withCredentials makes the browser send the httpOnly session cookie. The
// token is never readable from JS, so nothing is attached by hand here.
const api = axios.create({ baseURL: '/api', withCredentials: true });

api.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    const url = err.config?.url ?? '';
    // A 401 from the session probe just means "not signed in" — redirecting on
    // it would bounce a visitor off the login page they are already on.
    const isSessionProbe = url.includes('/auth/me') || url.includes('/auth/login');

    if (err.response?.status === 401 && !isSessionProbe) {
      localStorage.removeItem('user');
      localStorage.removeItem('gym');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

/** Pulls the API's `{ error }` message out of a failed request. */
export function apiError(err: unknown, fallback = 'Something went wrong'): string {
  const message = (err as AxiosError<{ error?: string }>)?.response?.data?.error;
  return message ?? fallback;
}

export default api;
