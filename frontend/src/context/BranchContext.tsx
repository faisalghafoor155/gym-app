import {
  createContext, useCallback, useContext, useEffect, useState, type ReactNode,
} from 'react';
import api from '../api/client';
import { useAuth } from './AuthContext';
import { BRANCH_KEY, readBranch } from '../utils/branch';
import type { Branch, BranchList } from '../types';

interface BranchValue {
  branches: Branch[];
  /** The branch in use; null means every branch. */
  current: string | null;
  currentBranch: Branch | null;
  /** Staff placed at one branch cannot switch. */
  fixed: boolean;
  /** More than one branch: only then is any of this worth showing. */
  multi: boolean;
  /** Switches branch. Reloads the app, so no page keeps another branch's rows. */
  switchTo: (id: string | null) => void;
  reload: () => Promise<void>;
}

const BranchContext = createContext<BranchValue | null>(null);

/**
 * The gym's branches and the one this browser is working in.
 *
 * The choice lives in localStorage and rides on every request as
 * X-Branch-Id (see api/client). The server has the last word: staff placed at
 * a branch get that branch whatever is sent, and the list it returns says so.
 */
export function BranchProvider({ children }: { children: ReactNode }) {
  const { isAuth, user } = useAuth();
  const [data, setData] = useState<BranchList | null>(null);
  const isStaff = isAuth && user?.role !== 'member';

  const reload = useCallback(async () => {
    if (!isStaff) { setData(null); return; }
    try {
      const r = await api.get<BranchList>('/branches');
      setData(r.data);
      // A choice the server would not honour — a deleted branch, or a fixed
      // staff account — is replaced by what it is actually using.
      const stored = readBranch();
      if ((r.data.current ?? null) !== stored) {
        try {
          if (r.data.current) localStorage.setItem(BRANCH_KEY, r.data.current);
          else localStorage.removeItem(BRANCH_KEY);
        } catch { /* storage blocked: the header simply is not sent */ }
      }
    } catch {
      setData(null);
    }
  }, [isStaff]);

  useEffect(() => { void reload(); }, [reload]);

  const switchTo = (id: string | null) => {
    try {
      if (id) localStorage.setItem(BRANCH_KEY, id);
      else localStorage.removeItem(BRANCH_KEY);
    } catch { /* ignore */ }
    window.location.reload();
  };

  const branches = data?.branches ?? [];
  const current = data?.current ?? null;
  return (
    <BranchContext.Provider value={{
      branches,
      current,
      currentBranch: branches.find(b => b.id === current) ?? null,
      fixed: !!data?.fixed,
      multi: branches.length > 1,
      switchTo,
      reload,
    }}>
      {children}
    </BranchContext.Provider>
  );
}

/** Outside the provider (a test, a screen before sign-in): one branch, nothing to pick. */
const SINGLE: BranchValue = {
  branches: [], current: null, currentBranch: null, fixed: false, multi: false,
  switchTo: () => {}, reload: async () => {},
};

export function useBranch(): BranchValue {
  return useContext(BranchContext) ?? SINGLE;
}
