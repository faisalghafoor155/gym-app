import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LanguageProvider } from '../../src/context/LanguageContext';
import LanguageToggle from '../../src/components/LanguageToggle';
import { PageHeader, SegmentedControl } from '../../src/components/ui';
import { Users } from 'lucide-react';

/**
 * The Urdu toggle.
 *
 * What matters is that translated strings switch, untranslated ones stay in
 * English rather than showing a key, and the choice survives a reload.
 */

const Screen = () => (
  <LanguageProvider>
    <LanguageToggle />
    <PageHeader icon={Users} title="Members" />
    <SegmentedControl value="all" onChange={() => {}} options={[
      { value: 'all', label: 'All' },
      { value: 'x', label: 'Something untranslated' },
    ]} />
  </LanguageProvider>
);

beforeEach(() => {
  localStorage.clear();
  document.documentElement.lang = '';
  document.documentElement.classList.remove('lang-ur');
});

describe('LanguageToggle', () => {
  it('switches page titles and tabs to Urdu, leaving unknown text in English', async () => {
    render(<Screen />);
    expect(screen.getByRole('heading', { name: 'Members' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: 'اردو' }));

    expect(screen.getByRole('heading', { name: 'ممبرز' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'سب' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Something untranslated' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('ur');
    expect(document.documentElement.classList.contains('lang-ur')).toBe(true);
  });

  it('remembers the choice on this device', async () => {
    const { unmount } = render(<Screen />);
    await userEvent.click(screen.getByRole('radio', { name: 'اردو' }));
    unmount();

    render(<Screen />);
    expect(screen.getByRole('heading', { name: 'ممبرز' })).toBeInTheDocument();
  });

  it('renders English outside the provider instead of throwing', () => {
    render(<PageHeader icon={Users} title="Members" />);
    expect(screen.getByRole('heading', { name: 'Members' })).toBeInTheDocument();
  });
});
