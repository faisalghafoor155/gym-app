import { useEffect, useRef } from 'react';
import api, { apiError } from '../api/client';
import type { AuthResponse } from '../types';
import toast from 'react-hot-toast';

const CLIENT_ID = import.meta.env['VITE_GOOGLE_CLIENT_ID'] as string | undefined;
const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

interface GoogleAccounts {
  accounts: {
    id: {
      initialize: (config: { client_id: string; callback: (r: { credential: string }) => void }) => void;
      renderButton: (el: HTMLElement, options: Record<string, string | number>) => void;
    };
  };
}

const loadScript = (): Promise<void> =>
  new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${SCRIPT_SRC}"]`)) return resolve();
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google script failed to load'));
    document.head.appendChild(script);
  });

/**
 * Renders Google's own sign-in button. Nothing is shown when no client id is
 * configured, so the app works normally before Google is set up.
 */
export default function GoogleSignIn({ onSuccess }: { onSuccess: (data: AuthResponse) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  useEffect(() => {
    if (!CLIENT_ID) return;

    let cancelled = false;
    void loadScript()
      .then(() => {
        const google = (window as unknown as { google?: GoogleAccounts }).google;
        if (cancelled || !google || !ref.current) return;

        google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (response) => {
            api.post<AuthResponse>('/auth/google', { credential: response.credential })
              .then(r => onSuccessRef.current(r.data))
              .catch(err => toast.error(apiError(err, 'Google sign-in failed')));
          },
        });
        google.accounts.id.renderButton(ref.current, {
          theme: 'outline', size: 'large', width: 320, text: 'signin_with',
        });
      })
      .catch(() => { /* offline or blocked — the password form still works */ });

    return () => { cancelled = true; };
  }, []);

  if (!CLIENT_ID) return null;

  return (
    <div className="mt-5">
      <div className="flex items-center gap-3 mb-4">
        <span className="h-px bg-gray-200 flex-1" />
        <span className="text-xs text-gray-400">or</span>
        <span className="h-px bg-gray-200 flex-1" />
      </div>
      <div ref={ref} className="flex justify-center" />
    </div>
  );
}
