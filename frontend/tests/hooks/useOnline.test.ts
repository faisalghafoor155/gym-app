import { afterEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useOnline } from '../../src/hooks/useOnline';

/**
 * The flag the offline banner and the write guard both read.
 *
 * `navigator.onLine` is a getter on a prototype jsdom does not let you assign
 * to directly, so each test redefines it and puts it back afterwards — leaving
 * it patched would make every later test in the run think it was offline.
 */
const setOnline = (value: boolean) => {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get: () => value,
  });
};

afterEach(() => setOnline(true));

describe('useOnline', () => {
  it('starts from the current navigator state', () => {
    setOnline(false);
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(false);
  });

  it('goes false when the browser reports offline', () => {
    setOnline(true);
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(true);

    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event('offline'));
    });

    expect(result.current).toBe(false);
  });

  it('recovers when the connection comes back', () => {
    setOnline(false);
    const { result } = renderHook(() => useOnline());

    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event('online'));
    });

    expect(result.current).toBe(true);
  });

  it('stops listening once unmounted', () => {
    setOnline(true);
    const { result, unmount } = renderHook(() => useOnline());
    unmount();

    // A listener surviving unmount would set state on a dead component, which
    // React reports as a warning rather than a failure — so assert the value
    // never moved instead of relying on the console.
    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event('offline'));
    });

    expect(result.current).toBe(true);
  });
});
