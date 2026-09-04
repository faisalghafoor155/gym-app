import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import api from '../api/client';
import type { Gym, SessionUser, Role } from '../types';

interface AuthValue {
  user: SessionUser | null;
  gym: Gym | null;
  role: Role | null;
  isAuth: boolean;
  /** Owner or staff — anyone who runs the gym. */
  isStaff: boolean;
  /** Owner only — staff accounts, ownership, gym settings. */
  isOwner: boolean;
  loading: boolean;
  login: (user: SessionUser, gym: Gym) => void;
  logout: () => void;
  /** Refreshes the cached gym after an owner edits its details. */
  updateGym: (gym: Gym) => void;
}

const AuthContext = createContext<AuthValue | null>(null);

// The session itself lives in an httpOnly cookie the browser sends on every
// request. What is cached here is only the display copy of who is signed in,
// so the first paint is not blank; /auth/me remains the source of truth.
const read = <T,>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(() => read<SessionUser>('user'));
  const [gym, setGym] = useState<Gym | null>(() => read<Gym>('gym'));
  const [loading, setLoading] = useState(true);

  // Only the server can tell whether the cookie is still valid, so every load
  // re-checks. This is also what keeps a revoked account from appearing signed
  // in from a stale cache.
  useEffect(() => {
    api.get<{ user: SessionUser; gym: Gym }>('/auth/me')
      .then(r => {
        setUser(r.data.user);
        setGym(r.data.gym);
        localStorage.setItem('user', JSON.stringify(r.data.user));
        localStorage.setItem('gym', JSON.stringify(r.data.gym));
      })
      .catch(() => {
        setUser(null);
        setGym(null);
        localStorage.removeItem('user');
        localStorage.removeItem('gym');
      })
      .finally(() => setLoading(false));
  }, []);

  const login: AuthValue['login'] = (userData, gymData) => {
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('gym', JSON.stringify(gymData));
    setUser(userData);
    setGym(gymData);
    setLoading(false);
  };

  /**
   * Replaces the cached gym after its details are edited.
   *
   * Without this, renaming the gym or setting its address leaves the old
   * values on screen — and on every receipt printed — until the next sign-in,
   * because the session's copy is only refreshed by `/auth/me` on load.
   */
  const updateGym: AuthValue['updateGym'] = (gymData) => {
    localStorage.setItem('gym', JSON.stringify(gymData));
    setGym(gymData);
  };

  const logout = () => {
    // The cookie is httpOnly, so the server has to clear it — and the same
    // call is what revokes the session server-side, so a token captured
    // earlier stops working rather than lasting out its 30 days.
    void api.post('/auth/logout').catch(() => { /* sign out locally regardless */ });
    localStorage.removeItem('user');
    localStorage.removeItem('gym');
    setUser(null);
    setGym(null);
  };

  const role = user?.role ?? null;

  return (
    <AuthContext.Provider value={{
      user, gym, role,
      isAuth: !!user,
      isStaff: role === 'owner' || role === 'staff',
      isOwner: role === 'owner',
      loading,
      login, logout, updateGym,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = (): AuthValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside an AuthProvider');
  return ctx;
};
