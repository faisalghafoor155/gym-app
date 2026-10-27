import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api, { apiError } from '../api/client';

interface UseFetchResult<T> {
  data: T | null;
  /** True until the first response lands. Drives the full-page spinner. */
  loading: boolean;
  /** True while a later fetch is in flight, with the old data still on screen.
   *  Drives the dimming that keeps a filter change from blanking the page. */
  refetching: boolean;
  /** Refetches the current url. For use after a mutation — it does not set
   *  `loading`, so saving a row does not throw the page back to a spinner. */
  reload: () => Promise<void>;
  /** Writes the cache directly, for the rare page that must reflect an edit
   *  without a round trip. */
  setData: (next: T | null) => void;
}

/**
 * The last response for each url, kept for the life of the tab.
 *
 * The API sits an ocean away from most gyms, so every page used to open on a
 * spinner for the length of a round trip — including one visited seconds ago.
 * A revisit now paints what it showed last time at once and refreshes it
 * quietly, the same dimming a filter change already uses.
 *
 * Memory only, never storage: it holds one gym's members and money, so it must
 * not outlive the session. `clearFetchCache` empties it whenever who is signed
 * in changes.
 */
const cache = new Map<string, unknown>();

export const clearFetchCache = (): void => cache.clear();

/** For pages that fetch by hand rather than through the hook. */
export const cachedResponse = <T,>(url: string): T | undefined => cache.get(url) as T | undefined;
export const cacheResponse = (url: string, body: unknown): void => { cache.set(url, body); };

/**
 * Loads `url` and keeps it in step with it.
 *
 * Refetches whenever the url changes — pass a url built from the page's
 * filters and the fetching follows them. The response of a superseded request
 * is dropped rather than applied: a filter change leaves the previous request
 * in flight, and letting it land afterwards would put stale rows on screen
 * under filters that no longer select them.
 *
 * Errors are reported as a toast and leave the previous data alone, so a
 * failed refetch degrades to "what you had, plus a message" rather than an
 * empty page. `data` is null only before the first successful load, which is
 * what lets a caller tell "still loading" from "loaded nothing".
 */
export function useFetch<T>(url: string, errorMessage: string): UseFetchResult<T> {
  const [data, setDataState] = useState<T | null>(() => (cache.get(url) as T | undefined) ?? null);
  const [loading, setLoading] = useState(() => !cache.has(url));
  const [refetching, setRefetching] = useState(false);

  // Bumped per request. A response is applied only if its ticket is still the
  // latest, which covers both a changed url and a `reload` racing the effect —
  // a per-effect cancel flag would only catch the first.
  const ticket = useRef(0);

  // Read inside `reload` so it can refetch the current url without listing it
  // as a dependency: `reload` is called from mutation handlers, and a new
  // identity on every url change would make it useless in a dependency array.
  const urlRef = useRef(url);
  urlRef.current = url;

  // `errorMessage` is a literal at every call site, but reading it through a
  // ref keeps `reload` stable even if a caller ever interpolates it.
  const errorRef = useRef(errorMessage);
  errorRef.current = errorMessage;

  // `quiet` leaves the full-page spinner alone: the page already has rows on
  // screen, so this fetch dims them instead of blanking them.
  const run = useCallback(async (quiet: boolean): Promise<void> => {
    const mine = ++ticket.current;
    if (quiet) setRefetching(true);
    try {
      const requested = urlRef.current;
      const { data: body } = await api.get<T>(requested);
      cache.set(requested, body);
      if (mine !== ticket.current) return;
      setDataState(body);
    } catch (err) {
      if (mine !== ticket.current) return;
      toast.error(apiError(err, errorRef.current));
    } finally {
      if (mine === ticket.current) {
        setLoading(false);
        setRefetching(false);
      }
    }
  }, []);

  // Lets the effect below decide first-load without depending on `data`, which
  // would refetch every time a response arrives.
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    // A url seen before — a tab switched back to — shows its last rows at once.
    if (cache.has(url)) setDataState(cache.get(url) as T);
    // The first load shows the spinner; once there are rows on screen a url
    // change dims them instead. Keyed off `data` rather than `loading`, so a
    // url that changes before the first response still reads as a first load.
    void run(dataRef.current !== null);
  }, [url, run]);

  // Always quiet: this runs after a save or a delete, and throwing the page
  // back to a full-page spinner over a one-row change reads as a reload.
  const reload = useCallback(() => run(true), [run]);

  // An edit written straight to the page must also reach the cache, or the
  // next visit would paint the row as it was before the edit.
  const setData = useCallback((next: T | null) => {
    if (next === null) cache.delete(urlRef.current);
    else cache.set(urlRef.current, next);
    setDataState(next);
  }, []);

  return { data, loading, refetching, reload, setData };
}
