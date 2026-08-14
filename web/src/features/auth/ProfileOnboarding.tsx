import { useState, type FormEvent } from "react";

import { completeCurrentUserProfile } from "./auth.api";
import type { AuthenticatedUserProfile } from "./auth.types";

type ProfileOnboardingProps = {
  accessToken: string;
  profile: AuthenticatedUserProfile;
  onCompleted: (profile: AuthenticatedUserProfile) => void;
  onSignOut: () => void;
};

export function ProfileOnboarding({
  accessToken,
  profile,
  onCompleted,
  onSignOut,
}: ProfileOnboardingProps) {
  const [fullName, setFullName] = useState(profile.fullName ?? "");
  const [phoneNumber, setPhoneNumber] = useState(profile.phoneNumber ?? "");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setErrorMessage(null);

    try {
      const completedProfile = await completeCurrentUserProfile(accessToken, {
        fullName,
        phoneNumber,
      });
      onCompleted(completedProfile);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "EcoTrack could not save your profile.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="profile-onboarding" aria-labelledby="profile-heading">
      <div className="onboarding-icon" aria-hidden="true">
        ✓
      </div>
      <div className="section-heading">
        <span className="eyebrow">One last step</span>
        <h2 id="profile-heading">Complete your EcoTrack profile</h2>
        <p>
          Add the contact details needed for cleanup-event coordination. You
          only need to do this once.
        </p>
      </div>

      <form className="login-form" onSubmit={submit}>
        <div className="form-group">
          <label htmlFor="profile-email">Verified email</label>
          <div className="input-wrapper profile-input-wrapper">
            <input id="profile-email" value={profile.email} disabled />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="full-name">Full name</label>
          <div className="input-wrapper profile-input-wrapper">
            <input
              id="full-name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              autoComplete="name"
              minLength={2}
              maxLength={120}
              disabled={saving}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="phone-number">Phone number</label>
          <div className="input-wrapper profile-input-wrapper">
            <input
              id="phone-number"
              type="tel"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              placeholder="+94 77 123 4567"
              autoComplete="tel"
              minLength={7}
              maxLength={30}
              disabled={saving}
              required
            />
          </div>
        </div>

        <p className="profile-privacy-note">
          Your phone number is private. It may be shown only to an authorized
          organization admin or event coordinator after you join their event.
        </p>

        {errorMessage ? (
          <p className="form-error" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <button className="button button-primary" disabled={saving}>
          {saving ? "Saving profile…" : "Continue to dashboard"}
        </button>
        <button
          className="button button-secondary"
          type="button"
          onClick={onSignOut}
          disabled={saving}
        >
          Sign out
        </button>
      </form>
    </section>
  );
}
