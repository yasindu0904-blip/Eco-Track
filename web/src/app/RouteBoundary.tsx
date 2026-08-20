import {
  Component,
  Suspense,
  type ErrorInfo,
  type ReactNode,
} from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

class RouteErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("An EcoTrack feature screen failed to render.", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="app-shell">
          <section className="auth-card">
            <div className="auth-card-content auth-state" role="alert">
              <h2>This EcoTrack screen could not open</h2>
              <p>Your session is safe. Reload the application and try again.</p>
              <button type="button" onClick={() => window.location.reload()}>
                Reload EcoTrack
              </button>
            </div>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

type RouteBoundaryProps = {
  children: ReactNode;
  resetKey: string;
};

export function RouteBoundary({ children, resetKey }: RouteBoundaryProps) {
  return (
    <RouteErrorBoundary key={resetKey}>
      <Suspense
        fallback={(
          <main className="app-shell">
            <section className="auth-card">
              <div className="auth-card-content auth-state auth-state-loading">
                <span className="loading-spinner" aria-hidden="true" />
                <h2>Opening EcoTrack</h2>
                <p>Loading this feature securely…</p>
              </div>
            </section>
          </main>
        )}
      >
        {children}
      </Suspense>
    </RouteErrorBoundary>
  );
}
