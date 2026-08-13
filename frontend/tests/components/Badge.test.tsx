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

describe('Badge', () => {
  it('shows the status it was given', () => {
    render(<Badge status="active" />);

    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('colours an expired membership red, to be noticed', () => {
    render(<Badge status="expired" />);

    expect(screen.getByText('expired')).toHaveClass('bg-red-100', 'text-red-700');
  });

  it('colours a lapsed one grey, so it does not compete', () => {
    render(<Badge status="lapsed" />);

    // Long gone rather than newly overdue — it must not draw the eye away from
    // the expired members the gym can still do something about.
    expect(screen.getByText('lapsed')).toHaveClass('bg-slate-200');
  });

  it('plays down a superseded membership, which is history not a problem', () => {
    render(<Badge status="superseded" />);

    expect(screen.getByText('superseded')).toHaveClass('bg-gray-100', 'text-gray-500');
  });

  it('separates paid from due', () => {
    const { rerender } = render(<Badge status="paid" />);
    expect(screen.getByText('paid')).toHaveClass('bg-green-100');

    rerender(<Badge status="due" />);
    expect(screen.getByText('due')).toHaveClass('bg-red-100');
  });

  it('falls back to neutral for a status it has no colour for', () => {
    render(<Badge status="something-new" />);

    // A status added on the server must render as plain rather than crash or
    // come out unstyled.
    expect(screen.getByText('something-new')).toHaveClass('bg-gray-100', 'text-gray-600');
  });
});
