import "./App.css";

import { LoginForm } from "./features/auth/LoginForm";
import { useAuthentication } from "./features/auth/useAuthentication";
import { OrganizationApplicationPage } from "./features/organizations/application";

function BrandHeader() {
  return (
    <header className="brand-header">
      <div className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 64 64" role="presentation">
          <path
            className="brand-stem"
            d="M32 48V24"
          />
          <path
            className="brand-leaf"
            d="M31 27C18 28 11 20 10 10c12-1 21 4 23 15"
          />
          <path
            className="brand-leaf brand-leaf-right"
            d="M33 30c12 0 20-7 21-17-11-2-20 3-23 14"
          />
          <path
            className="brand-soil"
            d="M18 53c2-9 7-14 14-14s12 5 14 14H18Z"
          />
        </svg>
      </div>

      <h1>EcoTrack</h1>
      <p>Community-Driven Environmental Action</p>
    </header>
  );
}

function LoadingState() {
  return (
    <section
      className="auth-state auth-state-loading"
      aria-live="polite"
    >
      <span className="loading-spinner" aria-hidden="true" />
      <h2>Securing your session</h2>
      <p>Please wait while EcoTrack verifies your sign-in.</p>
    </section>
  );
}

interface AuthenticationErrorProps {
  message: string;
  onRetry: () => void;
  onSignOut: () => void;
}

function AuthenticationError({
  message,
  onRetry,
  onSignOut,
}: AuthenticationErrorProps) {
  return (
    <section className="auth-state" role="alert">
      <div className="state-icon state-icon-error" aria-hidden="true">
        !
      </div>
      <h2>We could not complete sign-in</h2>
      <p>{message}</p>

      <div className="button-stack">
        <button
          className="button button-primary"
          type="button"
          onClick={onRetry}
        >
          Try again
        </button>
        <button
          className="button button-secondary"
          type="button"
          onClick={onSignOut}
        >
          Return to sign in
        </button>
      </div>
    </section>
  );
}

function App() {
  const {
    status,
    profile,
    accessToken,
    errorMessage,
    retry,
    signOut,
  } = useAuthentication();

  const isOrganizationPreview =
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get("organization-preview") === "1";

  if (isOrganizationPreview) {
    return <OrganizationApplicationPage />;
  }

  if (status === "signedIn" && profile && accessToken) {
    return (
      <OrganizationApplicationPage
        accessToken={accessToken}
        profile={profile}
        onSignOut={signOut}
      />
    );
  }

  return (
    <main className="app-shell">
      <div className="background-orb background-orb-one" />
      <div className="background-orb background-orb-two" />

      <section className="auth-card">
        <BrandHeader />

        <div className="auth-card-content">
          {status === "loading" && <LoadingState />}

          {status === "signedOut" && <LoginForm />}

          {status === "error" && errorMessage && (
            <AuthenticationError
              message={errorMessage}
              onRetry={retry}
              onSignOut={signOut}
            />
          )}
        </div>
      </section>

      <p className="app-footer">
        Small actions. Shared responsibility. Cleaner communities.
      </p>
    </main>
  );
}

export default App;
