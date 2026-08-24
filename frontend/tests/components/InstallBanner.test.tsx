import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import InstallBanner from '../../src/components/InstallBanner';

/**
 * The install offer, and — mostly — the rules about when *not* to make it.
 *
 * The dismissal is the case worth pinning down. "Not now" that forgets is a
 * banner the owner declines again every visit, and the whole reason for
 * capturing Chrome's event instead of letting it nag on its own schedule is
 * that ours can be made to take no for an answer.
 */

/** Chrome's event, as far as the component is concerned. */
const promptEvent = (outcome: 'accepted' | 'dismissed' = 'accepted') => {
  const evt = new Event('beforeinstallprompt') as Event & {
    prompt: ReturnType<typeof vi.fn>;
    userChoice: Promise<{ outcome: string }>;
  };
  evt.prompt = vi.fn(() => Promise.resolve());
  evt.userChoice = Promise.resolve({ outcome });
  return evt;
};

const fire = (evt: Event) => act(() => { window.dispatchEvent(evt); });

const setUserAgent = (ua: string) => {
  Object.defineProperty(navigator, 'userAgent', { configurable: true, get: () => ua });
};

const CHROME_ANDROID =
  'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36';
const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1';

/** jsdom has no matchMedia; standalone is the query the component asks about. */
const setStandalone = (standalone: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      matches: standalone && query.includes('standalone'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
};

beforeEach(() => {
  localStorage.clear();
  setUserAgent(CHROME_ANDROID);
  setStandalone(false);
});

afterEach(() => localStorage.clear());

describe('InstallBanner', () => {
  it('shows nothing until the browser says the app is installable', () => {
    render(<InstallBanner />);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('offers the install once the event arrives', () => {
    render(<InstallBanner />);
    fire(promptEvent());

    expect(screen.getByRole('region', { name: /install/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Install' })).toBeInTheDocument();
  });

  it('replays the captured event when Install is clicked', async () => {
    render(<InstallBanner />);
    const evt = promptEvent();
    fire(evt);

    await userEvent.click(screen.getByRole('button', { name: 'Install' }));

    expect(evt.prompt).toHaveBeenCalledOnce();
    // The banner goes as soon as the browser dialog takes over, so there is no
    // second, dead click waiting behind it.
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('remembers a dismissal, so it is not offered again', async () => {
    const { unmount } = render(<InstallBanner />);
    fire(promptEvent());

    await userEvent.click(screen.getByRole('button', { name: /not now/i }));
    expect(screen.queryByRole('region')).not.toBeInTheDocument();

    // A fresh mount is the next visit.
    unmount();
    render(<InstallBanner />);
    fire(promptEvent());

    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('treats declining the browser dialog as a dismissal too', async () => {
    const { unmount } = render(<InstallBanner />);
    fire(promptEvent('dismissed'));

    await userEvent.click(screen.getByRole('button', { name: 'Install' }));

    unmount();
    render(<InstallBanner />);
    fire(promptEvent());

    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('says nothing when the app is already running installed', () => {
    setStandalone(true);
    render(<InstallBanner />);
    fire(promptEvent());

    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('points iOS at the Share menu, since it has no install to call', () => {
    setUserAgent(IPHONE_SAFARI);
    render(<InstallBanner />);

    // No event is ever fired on iOS — the hint has to appear without one.
    expect(screen.getByRole('region', { name: /install/i }))
      .toHaveTextContent(/add to home screen/i);
    expect(screen.queryByRole('button', { name: 'Install' })).not.toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    render(<InstallBanner />);
    fire(promptEvent());

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });
});
