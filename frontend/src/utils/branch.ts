/** Where this browser keeps the branch it is working in. */
export const BRANCH_KEY = 'gymflow.branch';

/** The stored branch id, or null for every branch. */
export const readBranch = (): string | null => {
  try {
    return localStorage.getItem(BRANCH_KEY);
  } catch {
    return null;
  }
};
