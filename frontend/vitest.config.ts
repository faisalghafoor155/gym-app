import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

/**
 * Test config, kept apart from vite.config.ts so the thing that builds the app
 * is not also carrying test settings. The plugins are merged in rather than
 * repeated: components under test have to be compiled by the same React plugin
 * that compiles them in the browser, or the two can disagree.
 */
export default mergeConfig(viteConfig, defineConfig({
  test: {
    // Tests live in tests/, mirroring the src/ tree, so src/ holds nothing but
    // the app that ships — the same split the backend uses.
    include: ['tests/**/*.test.{ts,tsx}'],

    // Components need a DOM. jsdom rather than a real browser: these are unit
    // tests of rendering and behaviour, and a browser would cost seconds per
    // file for fidelity they do not use.
    environment: 'jsdom',

    // Registers jest-dom's matchers and clears the DOM between tests.
    setupFiles: ['./tests/setup.ts'],

    // Threads rather than the default forked processes. A forked worker never
    // finishes starting when the project path contains a space — it is handed
    // a percent-encoded path ("Gym%20App") it cannot resolve, and the run dies
    // on "Timeout waiting for worker to respond" with no tests attempted.
    // Threads share the parent's resolution and are unaffected.
    pool: 'threads',

    // Vite's dev proxy is irrelevant here — every test stubs the API layer
    // rather than reaching a server — but leaving it merged in is harmless and
    // keeps the two configs from drifting.
    css: false,
  },
}));
