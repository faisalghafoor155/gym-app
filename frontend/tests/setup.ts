import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

/**
 * Shared setup for the frontend suite.
 *
 * Unmounts whatever the last test rendered and drops any stubs it installed.
 * Without this, a component left mounted keeps firing timers and effects into
 * the next test, and one file's `vi.mock` quietly changes the behaviour of the
 * next — the kind of failure that only shows up when the files run in a
 * particular order.
 */
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
