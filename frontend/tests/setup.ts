import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// jsdom has no matchMedia, and the install prompt asks it whether the app is
// running standalone on every page that renders the button. Answers "no match"
// by default; tests that care (InstallBanner) redefine it, hence configurable.
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

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
  // `clearAllMocks`, not `restoreAllMocks`: restore *undoes* a mock, which for
  // a bare `vi.fn()` means replacing its implementation with an empty one. A
  // suite that builds its API stub out of `vi.fn()`s would find them returning
  // `undefined` from the second test onward — the page then renders its error
  // state, and the failure looks like a bug in the page rather than in this
  // line. Clearing resets calls and leaves implementations alone; the spies
  // that genuinely need restoring say so where they are installed.
  vi.clearAllMocks();
});
