import { ListMemoryProvider } from "./components/lists/ListMemoryProvider";
import type { ReactNode } from "react";

import "./App.css";

import { AuthenticatedUserApp } from "./app/AuthenticatedUserApp";
import { SuperAdminApp } from "./app/SuperAdminApp";
import { hasCompletedProfile } from "./authorization/authorizationUi";
import { EcoTrackMark } from "./components/EcoTrackMark";
import { LoginForm } from "./features/auth/LoginForm";
import { ProfileOnboarding } from "./features/auth/ProfileOnboarding";
import { useAuthentication } from "./features/auth/useAuthentication";

function BrandHeader() {
  return (
    <header className="brand-header">
      <div className="brand-mark" aria-hidden="true">
        <EcoTrackMark />
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
      <ListMemoryProvider key={profile.id}><SuperAdminApp
        profile={profile}
        accessToken={accessToken}
        onSignOut={signOut}
      /></ListMemoryProvider>
    );
  }

  return (
    <ListMemoryProvider key={profile.id}><AuthenticatedUserApp
      profile={profile}
      accessToken={accessToken}
      onProfileUpdated={replaceProfile}
      onSignOut={signOut}
    /></ListMemoryProvider>
  );
}

export default App;
