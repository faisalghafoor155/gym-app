import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import ErrorBoundary from '../../src/components/ErrorBoundary';

/**
 * The boundary exists to replace the worst failure the app can show — a blank
 * white page with no message and no way back — so what is worth asserting is
 * that something readable and actionable survives a render that throws.
 *
 * React logs every caught error to the console itself, which would bury the
 * suite's real output in stack traces. Silenced per test rather than globally,
 * so an unexpected error elsewhere still shows up.
 */
let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

function Boom({ throws = true }: { throws?: boolean }): React.ReactElement {
  if (throws) throw new Error('exploded while rendering');
  return <p>recovered content</p>;
}

describe('ErrorBoundary', () => {
  it('renders its children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>the real page</p>
      </ErrorBoundary>,
    );

    expect(screen.getByText('the real page')).toBeInTheDocument();
  });

  it('shows a readable message instead of a blank page', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    // The reassurance matters as much as the error: the front desk has to know
    // whether the fee they just recorded went through.
    expect(screen.getByText(/nothing was saved or changed/i)).toBeInTheDocument();
  });

  it('offers a way out', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload the page/i })).toBeInTheDocument();
  });

  it('reports the error rather than swallowing it', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    // Whatever error tracking is added later hangs off componentDidCatch, so
    // an error that never reaches it is one nobody finds out about.
    expect(consoleError).toHaveBeenCalled();
    const logged = consoleError.mock.calls.flat().join(' ');
    expect(logged).toContain('exploded while rendering');
  });

  it('recovers when the cause has gone away', async () => {
    const user = userEvent.setup();

    // Mirrors the real case: something transient made a render throw, and the
    // next attempt succeeds. "Try again" has to actually retry.
    function Flaky() {
      const [broken, setBroken] = useState(true);
      return (
        <>
          <button onClick={() => setBroken(false)}>fix it</button>
          <ErrorBoundary>
            <Boom throws={broken} />
          </ErrorBoundary>
        </>
      );
    }

    render(<Flaky />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'fix it' }));
    await user.click(screen.getByRole('button', { name: /try again/i }));

    expect(screen.getByText('recovered content')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('uses a caller-supplied fallback when given one', () => {
    render(
      <ErrorBoundary fallback={<p>just this panel is broken</p>}>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByText('just this panel is broken')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('keeps one failure from taking down a sibling', () => {
    render(
      <div>
        <ErrorBoundary>
          <Boom />
        </ErrorBoundary>
        <p>the rest of the page</p>
      </div>,
    );

    // The point of nesting a boundary inside the app chrome: the nav stays up
    // and the user can walk away from the broken page.
    expect(screen.getByText('the rest of the page')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });
});
