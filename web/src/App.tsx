import type { ReactNode } from "react";

import "./App.css";

import { AuthenticatedUserApp } from "./app/AuthenticatedUserApp";
import { SuperAdminApp } from "./app/SuperAdminApp";
import { hasCompletedProfile } from "./authorization/authorizationUi";
import { LoginForm } from "./features/auth/LoginForm";
import { ProfileOnboarding } from "./features/auth/ProfileOnboarding";
import { useAuthentication } from "./features/auth/useAuthentication";

function BrandHeader() {
  return (
    <header className="brand-header">
      <div className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 64 64" role="presentation">
          <path className="brand-stem" d="M32 48V24" />
          <path className="brand-leaf" d="M31 27C18 28 11 20 10 10c12-1 21 4 23 15" />
          <path className="brand-leaf brand-leaf-right" d="M33 30c12 0 20-7 21-17-11-2-20 3-23 14" />
          <path className="brand-soil" d="M18 53c2-9 7-14 14-14s12 5 14 14H18Z" />
        </svg>
      </div>
      <h1>EcoTrack</h1>
      <p>Community-Driven Environmental Action</p>
    </header>
  );
}

function AuthenticationShell({ children }: { children: ReactNode }) {
  return (
    <main className="app-shell">
      <div className="background-orb background-orb-one" />
      <div className="background-orb background-orb-two" />
      <section className="auth-card">
        <BrandHeader />
        <div className="auth-card-content">{children}</div>
      </section>
    </main>
  );
}

function App() {
  const {
    status,
    profile,
    accessToken,
    errorMessage,
    replaceProfile,
    retry,
    signOut,
  } = useAuthentication();

  if (status === "loading") {
    return (
      <AuthenticationShell>
        <section className="auth-state auth-state-loading" aria-live="polite">
          <span className="loading-spinner" aria-hidden="true" />
          <h2>Securing your session</h2>
          <p>Please wait while EcoTrack verifies your sign-in.</p>
        </section>
      </AuthenticationShell>
    );
  }

  if (status === "signedOut") {
    return <AuthenticationShell><LoginForm /></AuthenticationShell>;
  }

  if (status === "error") {
    return (
      <AuthenticationShell>
        <section className="auth-state" role="alert">
          <div className="state-icon state-icon-error" aria-hidden="true">!</div>
          <h2>We could not complete sign-in</h2>
          <p>{errorMessage ?? "Authentication failed."}</p>
          <div className="button-stack">
            <button className="button button-primary" type="button" onClick={retry}>
              Try again
            </button>
            <button className="button button-secondary" type="button" onClick={signOut}>
              Return to sign in
            </button>
          </div>
        </section>
      </AuthenticationShell>
    );
  }

  if (!profile || !accessToken) return null;

  if (!hasCompletedProfile(profile)) {
    return (
      <AuthenticationShell>
        <ProfileOnboarding
          accessToken={accessToken}
          profile={profile}
          onCompleted={replaceProfile}
          onSignOut={signOut}
        />
      </AuthenticationShell>
    );
  }

  if (profile.platformRole === "SUPER_ADMIN") {
    return (
      <SuperAdminApp
        profile={profile}
        accessToken={accessToken}
        onSignOut={signOut}
      />
    );
  }

  return (
    <AuthenticatedUserApp
      profile={profile}
      accessToken={accessToken}
      onProfileUpdated={replaceProfile}
      onSignOut={signOut}
    />
  );
}

export default App;
