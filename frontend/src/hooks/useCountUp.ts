import { useEffect, useRef, useState } from 'react';

const prefersReducedMotion = () =>
  typeof window !== 'undefined'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * A number that runs up to `target` instead of appearing at it.
 *
 * The first render counts from zero; a later change (a refetch, a new filter)
 * runs from whatever is on screen to the new value, so a refreshed dashboard
 * moves by the difference rather than starting over. Reduced motion skips
 * straight to the value: the CSS rule that stills every animation cannot reach
 * one driven from JavaScript.
 */
export function useCountUp(target: number, duration = 600): number {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0));
  // What is on screen right now, so an interrupted run resumes from there.
  const shown = useRef(value);

  useEffect(() => {
    const from = shown.current;
    if (from === target || prefersReducedMotion()) {
      shown.current = target;
      setValue(target);
      return;
    }

    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - t) ** 3;
      const next = t === 1 ? target : from + (target - from) * eased;
      shown.current = next;
      setValue(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  // Whole numbers stay whole on the way up; "Rs. 12,345.67" mid-count reads as
  // a wrong amount rather than as motion.
  return Number.isInteger(target) ? Math.round(value) : value;
}
