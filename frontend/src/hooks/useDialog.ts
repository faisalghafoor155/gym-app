import { useEffect, useRef } from 'react';

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',');

/** How long the exit animation in index.css runs. */
const CLOSE_MS = 150;

/**
 * Plays a dialog's exit animation, then calls `onClose`.
 *
 * The parent decides when a dialog unmounts, so the only way to animate it out
 * is to mark it closing and hand over a moment later. Anything that closes it
 * some other way (a save, a route change) simply unmounts it at once, which is
 * the right fallback rather than a bug.
 */
export function closeDialog(node: HTMLElement | null, onClose: () => void) {
  // The full-screen layer the panel sits in, or the node itself when the ref
  // is on that layer.
  const overlay = node?.closest<HTMLElement>('.fixed') ?? node;
  const instant = !overlay
    || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (instant) {
    onClose();
    return;
  }
  // A second click during the animation is the same close, not another one.
  if (overlay.hasAttribute('data-closing')) return;
  overlay.setAttribute('data-closing', '');
  window.setTimeout(() => {
    // Already gone: something else closed it in the meantime.
    if (overlay.isConnected) onClose();
  }, CLOSE_MS);
}

/**
 * Wires up the behaviour every overlay needs: Escape to close, focus trapped
 * inside, background scroll locked, and focus restored to whatever opened it.
 *
 * Returns a ref to attach to the dialog container.
 */
export function useDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  // Kept in a ref so changing the handler doesn't re-run the effect and steal
  // focus back to the first field mid-edit.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const node = ref.current;
    node?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeDialog(node, () => onCloseRef.current());
        return;
      }
      if (e.key !== 'Tab' || !node) return;

      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter(el => el.offsetParent !== null);
      if (items.length === 0) return;

      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;

      if (e.shiftKey && (active === first || !node.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus();
    };
  }, [open]);

  return ref;
}
