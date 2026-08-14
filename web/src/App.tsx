import { useState } from "react";

import "./App.css";

import { LoginForm } from "./features/auth/LoginForm";
import { ProfileOnboarding } from "./features/auth/ProfileOnboarding";
import { useAuthentication } from "./features/auth/useAuthentication";
import { CitizenDashboard } from "./features/citizen/CitizenDashboard";
import { OrganizationApplicationPage } from "./features/organizations/application";
import { SuperAdminDashboard } from "./features/super-admin/SuperAdminDashboard";

const previewSuperAdminProfile = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "superadmin@ecotrack.local",
  fullName: "EcoTrack Super Admin",
  phoneNumber: null,
  profileCompletedAt: null,
  platformRole: "SUPER_ADMIN",
  accountStatus: "ACTIVE",
} as const;

const previewCitizenProfile = {
  id: "00000000-0000-4000-8000-000000000002",
  email: "citizen@ecotrack.local",
  fullName: "EcoTrack Citizen",
  phoneNumber: null,
  profileCompletedAt: null,
  platformRole: "USER",
  accountStatus: "ACTIVE",
} as const;

type CitizenView =
  | "dashboard"
  | "organization-apply"
  | "organization-applications";

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
  const [citizenView, setCitizenView] =
    useState<CitizenView>("dashboard");

  const {
    status,
    profile,
    accessToken,
    errorMessage,
    checkSuperAdminAccess,
    replaceProfile,
    retry,
    signOut,
  } = useAuthentication();

  const searchParameters = new URLSearchParams(window.location.search);

  const isOrganizationPreview =
    import.meta.env.DEV &&
    searchParameters.get("organization-preview") === "1";

  const isSuperAdminPreview =
    import.meta.env.DEV &&
    searchParameters.get("super-admin-preview") === "1";

  const isCitizenPreview =
    import.meta.env.DEV &&
    searchParameters.get("citizen-preview") === "1";

  if (isSuperAdminPreview) {
    return (
      <SuperAdminDashboard
        profile={previewSuperAdminProfile}
        onCheckAccess={() =>
          Promise.resolve("Preview mode: protected access UI is ready.")
        }
        onSignOut={() => undefined}
      />
    );
  }

  if (isOrganizationPreview) {
    return <OrganizationApplicationPage />;
  }

  if (isCitizenPreview) {
    if (citizenView !== "dashboard") {
      return (
        <OrganizationApplicationPage
          key={citizenView}
          profile={previewCitizenProfile}
          initialView={
            citizenView === "organization-applications"
              ? "applications"
              : "apply"
          }
          onBackToDashboard={() => {
            setCitizenView("dashboard");
          }}
        />
      );
    }

    return (
      <CitizenDashboard
        profile={previewCitizenProfile}
        onStartOrganizationApplication={() => {
          setCitizenView("organization-apply");
        }}
        onViewOrganizationApplications={() => {
          setCitizenView("organization-applications");
        }}
        onSignOut={() => undefined}
      />
    );
  }

  if (status === "signedIn" && profile && accessToken) {
    if (
      !profile.profileCompletedAt ||
      !profile.fullName?.trim() ||
      !profile.phoneNumber?.trim()
    ) {
      return (
        <main className="app-shell">
          <section className="auth-card">
            <BrandHeader />

            <div className="auth-card-content">
              <ProfileOnboarding
                accessToken={accessToken}
                profile={profile}
                onCompleted={replaceProfile}
                onSignOut={signOut}
              />
            </div>
          </section>
        </main>
      );
    }

    if (profile.platformRole === "SUPER_ADMIN") {
      return (
        <SuperAdminDashboard
          profile={profile}
          accessToken={accessToken}
          onCheckAccess={checkSuperAdminAccess}
          onSignOut={() => {
            setCitizenView("dashboard");
            signOut();
          }}
        />
      );
    }

    if (citizenView === "dashboard") {
      return (
        <CitizenDashboard
          profile={profile}
          onStartOrganizationApplication={() => {
            setCitizenView("organization-apply");
          }}
          onViewOrganizationApplications={() => {
            setCitizenView("organization-applications");
          }}
          onSignOut={() => {
            setCitizenView("dashboard");
            signOut();
          }}
        />
      );
    }

    return (
      <OrganizationApplicationPage
        key={citizenView}
        accessToken={accessToken}
        profile={profile}
        initialView={
          citizenView === "organization-applications"
            ? "applications"
            : "apply"
        }
        onBackToDashboard={() => {
          setCitizenView("dashboard");
        }}
        onSignOut={() => {
          setCitizenView("dashboard");
          signOut();
        }}
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
