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
