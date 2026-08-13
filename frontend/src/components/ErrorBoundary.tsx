import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  /** Shown instead of the default screen, for a boundary around one panel
   *  rather than the whole app. */
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches a render error so one broken component does not take the app with it.
 *
 * React unmounts the entire tree when a render throws and nothing catches it,
 * which leaves a blank white page — no message, no way back, and nothing on
 * screen to report. That is the worst failure the app can show, because it is
 * indistinguishable from the server being down.
 *
 * This has to be a class: `componentDidCatch` and `getDerivedStateFromError`
 * have no hook equivalent, and still do not as of React 19.
 *
 * It deliberately catches only render errors. A failed API call is already
 * handled where it is made, with a toast and a page that stays usable — routing
 * those here would replace a recoverable error with a full-screen one.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // The console is the only reporter this app has. When error tracking is
    // added, this is the single place it needs to be wired into — which is
    // most of the reason the boundary logs here rather than in render.
    console.error('Unhandled render error:', error, info.componentStack);
  }

  /** Clears the error so the tree remounts. Enough on its own when the failure
   *  was transient; the reload below is for when it is not. */
  private reset = (): void => { this.setState({ error: null }); };

  private reload = (): void => { window.location.reload(); };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="min-h-dvh flex items-center justify-center p-6 bg-gray-50 dark:bg-slate-950">
        <div className="max-w-md w-full text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-5">
            <AlertTriangle size={26} />
          </div>

          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">
            Something went wrong
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-2">
            This page hit an error and could not finish loading. Your data has
            not been affected — nothing was saved or changed.
          </p>

          <div className="flex gap-3 justify-center mt-6">
            <button
              onClick={this.reset}
              className="inline-flex items-center justify-center gap-2 bg-white dark:bg-slate-800
                text-gray-700 dark:text-slate-200 px-4 py-2.5 rounded-xl text-sm font-semibold
                border border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700
                transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Try again
            </button>
            <button
              onClick={this.reload}
              className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white
                px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700
                transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <RotateCcw size={15} />
              Reload the page
            </button>
          </div>

          {/*
            The message itself, not a stack trace: it is what somebody can read
            out over the phone when reporting the fault. Kept in dev only —
            in production an error string can name internals, and it is not
            something the front desk can act on anyway.
          */}
          {import.meta.env.DEV && (
            <pre className="mt-6 text-left text-xs bg-gray-100 dark:bg-slate-900 text-red-700
              dark:text-red-300 rounded-xl p-4 overflow-x-auto whitespace-pre-wrap
              border border-gray-200 dark:border-slate-800">
              {error.message}
            </pre>
          )}
        </div>
      </div>
    );
  }
}
