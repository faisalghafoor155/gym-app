/**
 * Turns rows into a CSV file the browser downloads. Deliberately dependency
 * free — the sheets a gym exports are small, and a library for this is a
 * library to keep patched.
 */

/** A field containing a comma, a quote or a newline has to be quoted, and an
 *  inner quote doubled — a note like `paid 2,500 "cash"` corrupts the file
 *  otherwise. */
const escape = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(headers: readonly string[], rows: readonly unknown[][]): string {
  return [headers, ...rows].map(r => r.map(escape).join(',')).join('\r\n');
}

/**
 * Downloads a CSV the server built.
 *
 * Preferred over `toCsv`/`downloadCsv` for anything the page pages or caps: a
 * file assembled from what the page happens to hold covers only that, and
 * nothing in the file says so. The server reads the whole set instead, and
 * sends its own filename and BOM.
 *
 * Uses `fetch` rather than navigating to the URL so a refusal arrives as an
 * error to show rather than as a blank tab, and so the session cookie goes
 * with it.
 */
export async function downloadFromServer(path: string): Promise<void> {
  const res = await fetch(path, { credentials: 'include' });
  if (!res.ok) {
    // The endpoints answer with JSON on the way out, so the reason survives.
    const body = await res.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? 'Export failed');
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  // Honour the name the server chose, falling back only if it sent none.
  link.download =
    /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1]
    ?? 'export.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadCsv(filename: string, csv: string): void {
  // The BOM is what makes Excel read the file as UTF-8; without it a member
  // name with an accent or Urdu character arrives mangled.
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
