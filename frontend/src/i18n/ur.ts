/**
 * Roman Urdu for every screen, keyed by the English text it replaces.
 *
 * Roman rather than Urdu script: it is what staff and members type in
 * WhatsApp every day, it reads in the same fonts as the names and numbers
 * around it, and the layout needs no right-to-left handling.
 *
 * Keyed by English rather than by ids so a string is translated by adding one
 * line, with no change at the call site beyond wrapping it in `t()`, and so
 * anything not yet translated stays in English instead of showing a key.
 * `{name}` placeholders must appear unchanged in the Roman Urdu.
 *
 * Split by area, one default-exported dictionary per file in ./ur/.
 */
const parts = import.meta.glob<Record<string, string>>('./ur/*.ts', { eager: true, import: 'default' });

export const UR: Record<string, string> = Object.assign(
  {},
  ...Object.keys(parts).sort().map(k => parts[k]),
);
