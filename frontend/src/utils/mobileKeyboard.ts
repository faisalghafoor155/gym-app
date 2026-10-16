/**
 * Keeps the field being typed into visible above the phone's keyboard.
 *
 * Every form here lives in a bottom sheet (`fixed inset-0` + `items-end`) with
 * the page scroll locked behind it. When the keyboard opens:
 *  - Android Chrome is told to resize the page (`interactive-widget` in
 *    index.html), so the sheet moves up — but the focused field can still sit
 *    below the fold of the sheet's own scroll area.
 *  - iOS Safari never resizes the layout viewport. Fixed overlays stay full
 *    height and the bottom of the sheet ends up underneath the keyboard.
 *
 * So, globally and once:
 *  1. `--keyboard-inset` / `--keyboard-top` describe where the visible area
 *     is, and `html.keyboard-open` is set; index.css uses them to shrink
 *     fixed overlays to the visible area and to hide the bottom nav bar.
 *  2. The focused field is scrolled into the middle of its scroll container
 *     once the keyboard has finished animating in.
 */

const TEXT_TYPES = new Set([
  'text', 'tel', 'email', 'number', 'password', 'search', 'url',
  'date', 'datetime-local', 'month', 'time', 'week',
]);

function isTextField(el: Element | null): el is HTMLElement {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLSelectElement) return false;
  if (el instanceof HTMLInputElement) return TEXT_TYPES.has(el.type);
  return el instanceof HTMLElement && el.isContentEditable;
}

/** Below this the change is the URL bar collapsing, not a keyboard. */
const KEYBOARD_MIN_PX = 150;

export function installKeyboardAvoidance(): void {
  if (typeof window === 'undefined') return;
  // Only touch devices get an on-screen keyboard; desktop (and Electron) is
  // left completely alone.
  if (!window.matchMedia('(pointer: coarse)').matches) return;

  const vv = window.visualViewport;
  const root = document.documentElement;
  let baseline = 0;
  let revealTimer: number | undefined;

  const visibleHeight = () => (vv ? vv.height : window.innerHeight);

  const reveal = () => {
    const el = document.activeElement;
    if (!isTextField(el)) return;
    const rect = el.getBoundingClientRect();
    const top = vv ? vv.offsetTop : 0;
    const bottom = top + visibleHeight();
    if (rect.top < top + 12 || rect.bottom > bottom - 12) {
      el.scrollIntoView({ block: 'center', inline: 'nearest' });
    }
  };

  const scheduleReveal = (ms: number) => {
    window.clearTimeout(revealTimer);
    revealTimer = window.setTimeout(reveal, ms);
  };

  const update = () => {
    const height = visibleHeight();
    baseline = Math.max(baseline, height, window.innerHeight);

    const open =
      isTextField(document.activeElement) && baseline - height > KEYBOARD_MIN_PX;

    // Only non-zero on iOS: Android already shrank innerHeight with the page.
    const inset = vv
      ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))
      : 0;
    const top = vv ? Math.max(0, Math.round(vv.offsetTop)) : 0;

    root.classList.toggle('keyboard-open', open);
    root.style.setProperty('--keyboard-inset', open ? `${inset}px` : '0px');
    root.style.setProperty('--keyboard-top', open ? `${top}px` : '0px');

    if (open) scheduleReveal(60);
  };

  // A rotation changes what "full height" means.
  const resetBaseline = () => {
    baseline = 0;
    window.setTimeout(update, 300);
  };

  vv?.addEventListener('resize', update);
  vv?.addEventListener('scroll', update);
  window.addEventListener('resize', update);
  window.addEventListener('orientationchange', resetBaseline);

  document.addEventListener('focusin', (e) => {
    if (!isTextField(e.target as Element)) return;
    // The keyboard animates in over ~250-300ms; measure after it settles.
    scheduleReveal(350);
    window.setTimeout(update, 350);
  });
  document.addEventListener('focusout', () => {
    // Focus may be moving straight to the next field; check after it lands.
    window.setTimeout(update, 100);
  });
}
