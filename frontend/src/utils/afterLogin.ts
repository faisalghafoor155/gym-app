/**
 * Where to go once a sign-in finishes, for pages that send a signed-out
 * visitor to /login and want them back afterwards.
 *
 * Only the QR check-in page uses it: a member scans the gym's code, is not
 * signed in on that phone yet, and should land back on the check-in rather
 * than on their home page with the scan forgotten.
 *
 * sessionStorage, not a URL parameter, so /login stays a page with nothing to
 * tamper with — and only same-app paths are ever accepted back.
 */
const KEY = 'gym:afterLogin';

export const rememberAfterLogin = (path: string): void => {
  try {
    sessionStorage.setItem(KEY, path);
  } catch {
    // Private mode or storage blocked: the member just lands on their home page.
  }
};

/** The remembered path, once. Null when there is none or it is not ours. */
export const takeAfterLogin = (): string | null => {
  try {
    const path = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return path && path.startsWith('/') && !path.startsWith('//') ? path : null;
  } catch {
    return null;
  }
};
