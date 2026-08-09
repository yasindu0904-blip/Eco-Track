import type { AuthenticatedUserProfile } from "./auth.types";
import { SuperAdminAccessPanel } from "./SuperAdminAccessPanel";

interface ProfileScreenProps {
  profile: AuthenticatedUserProfile;
  onSignOut: () => void;
  onCheckSuperAdminAccess: () => Promise<string>;
}

function formatEnumLabel(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function ProfileScreen({
  profile,
  onSignOut,
  onCheckSuperAdminAccess,
}: ProfileScreenProps) {
  const displayName = profile.fullName ?? "EcoTrack member";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <section className="profile-panel" aria-live="polite">
      <div className="profile-success">
        <div className="state-icon state-icon-success" aria-hidden="true">
          <svg viewBox="0 0 24 24" role="presentation">
            <path d="m5 12 4 4L19 6" />
          </svg>
        </div>
        <span>Authentication complete</span>
      </div>

      <div className="profile-heading">
        <div className="profile-avatar" aria-hidden="true">
          {initial}
        </div>
        <div>
          <p>Welcome to EcoTrack</p>
          <h2>{displayName}</h2>
        </div>
      </div>

      <dl className="profile-details">
        <div>
          <dt>Email</dt>
          <dd>{profile.email}</dd>
        </div>
        <div>
          <dt>Platform role</dt>
          <dd>
            <span className="status-badge">
              {formatEnumLabel(profile.platformRole)}
            </span>
          </dd>
        </div>
        <div>
          <dt>Account status</dt>
          <dd>
            <span className="status-badge status-badge-active">
              <span aria-hidden="true" />
              {formatEnumLabel(profile.accountStatus)}
            </span>
          </dd>
        </div>
      </dl>

      <p className="profile-note">
        Supabase verified your identity, and the EcoTrack API loaded your
        PostgreSQL profile.
      </p>

      <SuperAdminAccessPanel
        platformRole={profile.platformRole}
        onCheckAccess={onCheckSuperAdminAccess}
      />

      <button
        className="button button-secondary"
        type="button"
        onClick={onSignOut}
      >
        Sign out
      </button>
    </section>
  );
}
