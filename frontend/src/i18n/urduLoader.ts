/**
 * The Roman Urdu dictionary is a few hundred kilobytes that an English screen
 * never reads, so it is its own chunk, fetched the first time Urdu is on.
 * Until it lands every lookup falls back to the English.
 */
let dictionary: Record<string, string> = {};
let loading: Promise<void> | null = null;

/** The Urdu for an English string, once the dictionary has loaded. */
export const urduFor = (english: string): string | undefined => dictionary[english];

export const loadUrdu = (): Promise<void> =>
  (loading ??= import('./ur').then(
    m => { dictionary = m.UR; },
    (err: unknown) => { loading = null; throw err; }, // let a later switch try again
  ));
