import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import Badge from '../../src/components/Badge';

/**
 * The status badge.
 *
 * A small component, but it is the thing the front desk actually reads off the
 * members page, and its colours carry meaning the text alone does not: expired
 * is red because somebody can still be won back, lapsed is grey because that
 * moment has passed. This is also the test that proves the React and jsdom
 * setup works at all.
 */

/** The pill itself — the text sits in its own span beside the status dot. */
const pill = (text: string): HTMLElement => screen.getByText(text).parentElement!;

describe('Badge', () => {
  it('shows the status it was given', () => {
    render(<Badge status="active" />);

    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('colours an expired membership red, to be noticed', () => {
    render(<Badge status="expired" />);

    expect(pill('expired')).toHaveClass('bg-rose-50', 'text-rose-700');
  });

  it('colours a lapsed one grey, so it does not compete', () => {
    render(<Badge status="lapsed" />);

    // Long gone rather than newly overdue — it must not draw the eye away from
    // the expired members the gym can still do something about.
    expect(pill('lapsed')).toHaveClass('bg-slate-100', 'text-slate-600');
  });

  it('plays down a superseded membership, which is history not a problem', () => {
    render(<Badge status="superseded" />);

    expect(pill('superseded')).toHaveClass('bg-gray-100', 'text-gray-500');
  });

  it('separates paid from due', () => {
    const { rerender } = render(<Badge status="paid" />);
    expect(pill('paid')).toHaveClass('bg-emerald-50');

    rerender(<Badge status="due" />);
    expect(pill('due')).toHaveClass('bg-rose-50');
  });

  it('falls back to neutral for a status it has no colour for', () => {
    render(<Badge status="something-new" />);

    // A status added on the server must render as plain rather than crash or
    // come out unstyled.
    expect(pill('something-new')).toHaveClass('bg-gray-100', 'text-gray-600');
  });
});
