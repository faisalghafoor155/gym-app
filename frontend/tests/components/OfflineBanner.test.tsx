import { afterEach, describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';

import OfflineBanner from '../../src/components/OfflineBanner';

const setOnline = (value: boolean) => {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get: () => value,
  });
};

afterEach(() => setOnline(true));

describe('OfflineBanner', () => {
  it('stays out of the way while online', () => {
    setOnline(true);
    render(<OfflineBanner />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('warns that changes will not save when offline', () => {
    setOnline(false);
    render(<OfflineBanner />);

    // The "can't be saved" half is the part that earns the strip; the rest the
    // user could infer from the failed loads.
    expect(screen.getByRole('status')).toHaveTextContent(/changes can't be saved/i);
  });

  it('clears itself when the connection returns', () => {
    setOnline(false);
    render(<OfflineBanner />);
    expect(screen.getByRole('status')).toBeInTheDocument();

    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event('online'));
    });

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
