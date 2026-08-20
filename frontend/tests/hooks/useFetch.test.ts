import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

/**
 * The shared loader behind the single-fetch pages.
 *
 * The case worth holding down hardest is the stale response. Every page that
 * refetches on a filter leaves the previous request in flight, and a slow one
 * landing after a fast one would put rows on screen that the current filters
 * do not select — a bug that only appears under a slow connection, which is
 * exactly where nobody is watching for it.
 */

const get = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());

vi.mock('../../src/api/client', () => ({
  default: { get },
  apiError: (_e: unknown, fallback = 'Something went wrong') => fallback,
}));

vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: toastError }),
}));

const { useFetch } = await import('../../src/hooks/useFetch');

/** A request whose resolution this test controls. */
const deferred = <T,>() => {
  let resolve!: (v: { data: T }) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<{ data: T }>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

describe('useFetch', () => {
  it('loads the url and clears loading', async () => {
    get.mockResolvedValue({ data: { name: 'Ali' } });

    const { result } = renderHook(() => useFetch<{ name: string }>('/members', 'nope'));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ name: 'Ali' });
    expect(get).toHaveBeenCalledWith('/members');
  });

  it('refetches when the url changes', async () => {
    get.mockResolvedValue({ data: ['a'] });

    const { result, rerender } = renderHook(
      ({ url }) => useFetch<string[]>(url, 'nope'),
      { initialProps: { url: '/members?page=1' } },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    get.mockResolvedValue({ data: ['b'] });
    rerender({ url: '/members?page=2' });

    await waitFor(() => expect(result.current.data).toEqual(['b']));
    expect(get).toHaveBeenLastCalledWith('/members?page=2');
  });

  it('drops a superseded response instead of letting it overwrite a newer one', async () => {
    const slow = deferred<string[]>();
    const fast = deferred<string[]>();
    get.mockReturnValueOnce(slow.promise).mockReturnValueOnce(fast.promise);

    const { result, rerender } = renderHook(
      ({ url }) => useFetch<string[]>(url, 'nope'),
      { initialProps: { url: '/members?search=a' } },
    );

    // The second filter is applied while the first request is still open.
    rerender({ url: '/members?search=ab' });

    await act(async () => {
      fast.resolve({ data: ['current'] });
      await fast.promise;
    });
    expect(result.current.data).toEqual(['current']);

    // The first request now lands. It must not be applied.
    await act(async () => {
      slow.resolve({ data: ['stale'] });
      await slow.promise;
    });

    expect(result.current.data).toEqual(['current']);
  });

  it('keeps the previous data and toasts when a refetch fails', async () => {
    get.mockResolvedValueOnce({ data: ['kept'] });

    const { result, rerender } = renderHook(
      ({ url }) => useFetch<string[]>(url, 'Could not load'),
      { initialProps: { url: '/a' } },
    );
    await waitFor(() => expect(result.current.data).toEqual(['kept']));

    get.mockRejectedValueOnce(new Error('offline'));
    rerender({ url: '/b' });

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Could not load'));
    // A failed refetch degrades to "what you had, plus a message".
    expect(result.current.data).toEqual(['kept']);
    expect(result.current.loading).toBe(false);
  });

  it('shows the spinner only for the first load, and dims for later ones', async () => {
    const first = deferred<string[]>();
    const second = deferred<string[]>();
    get.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const { result, rerender } = renderHook(
      ({ url }) => useFetch<string[]>(url, 'nope'),
      { initialProps: { url: '/a' } },
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.refetching).toBe(false);

    await act(async () => { first.resolve({ data: ['a'] }); await first.promise; });
    expect(result.current.loading).toBe(false);

    rerender({ url: '/b' });
    // The old rows stay on screen, dimmed, rather than the page blanking.
    await waitFor(() => expect(result.current.refetching).toBe(true));
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual(['a']);

    await act(async () => { second.resolve({ data: ['b'] }); await second.promise; });
    expect(result.current.refetching).toBe(false);
  });

  it('reload refetches the current url without showing the spinner', async () => {
    get.mockResolvedValue({ data: ['before'] });

    const { result } = renderHook(() => useFetch<string[]>('/members?status=active', 'nope'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    get.mockResolvedValue({ data: ['after'] });
    await act(async () => { await result.current.reload(); });

    expect(result.current.data).toEqual(['after']);
    // Saving a row must not throw the page back to a full-page spinner.
    expect(result.current.loading).toBe(false);
    // The filters in force are what gets refetched, not the mount-time url.
    expect(get).toHaveBeenLastCalledWith('/members?status=active');
  });

  it('keeps reload stable across url changes so effects do not loop', async () => {
    get.mockResolvedValue({ data: [] });

    const { result, rerender } = renderHook(
      ({ url }) => useFetch<string[]>(url, 'nope'),
      { initialProps: { url: '/a' } },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    const before = result.current.reload;

    rerender({ url: '/b' });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.reload).toBe(before);
  });
});
