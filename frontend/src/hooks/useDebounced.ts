import { useEffect, useState } from 'react';

/**
 * Holds a value back until it stops changing, so a search box fires one request
 * per pause instead of one per keystroke.
 */
export function useDebounced<T>(value: T, delay = 350): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return settled;
}
