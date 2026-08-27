/**
 * Downloading a CSV the server built.
 *
 * There is deliberately no CSV *builder* here. A file assembled in the page
 * covers only what the page happens to be holding — one page of a list, or the
 * first fifty rows of a report — and nothing in the file says so, so it gets
 * reconciled against a bank statement and the shortfall is blamed on the books.
 * Every export therefore goes through an endpoint that reads the whole matching
 * set; see `backend/src/services/csv.ts` for the writing half.
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
