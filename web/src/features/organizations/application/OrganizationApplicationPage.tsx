import {
  useEffect,
  useState,
  type FormEvent,
} from "react";

import type { AuthenticatedUserProfile } from "../../auth/auth.types";
import {
  createOrganizationApplication,
  listAdministrativeAreas,
  listMyOrganizationApplications,
} from "./organizationApplication.api";
import type {
  AdministrativeArea,
  CreateOrganizationApplicationInput,
  OrganizationApplication,
  OrganizationStatus,
} from "./organizationApplication.types";
import "./organizationApplication.css";

interface OrganizationApplicationPageProps {
  accessToken?: string;
  profile?: AuthenticatedUserProfile;
  initialView?: "apply" | "applications";
  onBackToDashboard?: () => void;
  onSignOut?: () => void;
}

function statusLabel(status: OrganizationStatus): string {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function OrganizationApplicationPage({
  accessToken,
  profile,
  initialView = "apply",
  onBackToDashboard,
  onSignOut,
}: OrganizationApplicationPageProps) {
  const [view, setView] =
    useState<"apply" | "applications">(initialView);
  const [applications, setApplications] = useState<OrganizationApplication[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingApplications, setIsLoadingApplications] = useState(
    initialView === "applications" && Boolean(accessToken),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [areaSearch, setAreaSearch] = useState("");
  const [availableAreas, setAvailableAreas] = useState<AdministrativeArea[]>([]);
  const [selectedAreaIds, setSelectedAreaIds] = useState<string[]>([]);
  const [isLoadingAreas, setIsLoadingAreas] = useState(Boolean(accessToken));

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    let isActive = true;
    const timeoutId = window.setTimeout(() => {
      setIsLoadingAreas(true);

      void listAdministrativeAreas(accessToken, areaSearch)
        .then((areas) => {
          if (isActive) {
            setAvailableAreas(areas);
          }
        })
        .catch((error: unknown) => {
          if (isActive) {
            setErrorMessage(
              error instanceof Error
                ? error.message
                : "Unable to load GN Divisions.",
            );
          }
        })
        .finally(() => {
          if (isActive) {
            setIsLoadingAreas(false);
          }
        });
    }, 300);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [accessToken, areaSearch]);

  async function loadApplications(): Promise<void> {
    if (!accessToken) {
      setErrorMessage("Sign in is required to load your applications.");
      return;
    }

    setIsLoadingApplications(true);
    setErrorMessage(null);

    try {
      setApplications(await listMyOrganizationApplications(accessToken));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load applications.",
      );
    } finally {
      setIsLoadingApplications(false);
    }
  }

  useEffect(() => {
    if (initialView !== "applications" || !accessToken) {
      return;
    }

    let isActive = true;

    void listMyOrganizationApplications(accessToken)
      .then((loadedApplications) => {
        if (!isActive) {
          return;
        }

        setApplications(loadedApplications);
        setErrorMessage(null);
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load applications.",
        );
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingApplications(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [accessToken, initialView]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!accessToken) {
      setErrorMessage("Sign in is required before submitting an application.");
      return;
    }

    setIsSubmitting(true);
    setMessage(null);
    setErrorMessage(null);

    const form = new FormData(event.currentTarget);

    try {
      const application: CreateOrganizationApplicationInput = {
        name: String(form.get("name")),
        registrationNumber: String(form.get("registrationNumber")) || undefined,
        description: String(form.get("description")) || undefined,
        officialEmail: String(form.get("officialEmail")),
        officialPhone: String(form.get("officialPhone")),
        officialAddress: String(form.get("officialAddress")),
        administrativeAreaIds: selectedAreaIds,
      };

      if (selectedAreaIds.length === 0) {
        throw new Error("Select at least one GN Division.");
      }

      const created = await createOrganizationApplication(accessToken, application);
      setMessage(`${created.name} was submitted for review.`);
      setSelectedAreaIds([]);
      await loadApplications();
      setView("applications");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to submit the application.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="organization-shell">
      <header className="organization-header">
        <div className="organization-header-start">
          {onBackToDashboard && (
            <button
              className="organization-back-button"
              type="button"
              onClick={onBackToDashboard}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m15 18-6-6 6-6" />
              </svg>
              Dashboard
            </button>
          )}
          <div>
            <span className="organization-brand">EcoTrack</span>
            <p>Organization onboarding</p>
          </div>
        </div>
        <div className="organization-user">
          <span>{profile ? profile.fullName ?? profile.email : "Development preview"}</span>
          {onSignOut ? (
            <button type="button" onClick={onSignOut}>Sign out</button>
          ) : (
            <span className="preview-badge">Preview mode</span>
          )}
        </div>
      </header>

      <section className="organization-content">
        <div className="organization-intro">
          <div>
            <span className="organization-eyebrow">Citizen application</span>
            <h1>Bring your environmental organization to EcoTrack</h1>
            <p>Submit your organization details and proposed service area for review.</p>
          </div>
          <div className="organization-step"><strong>1</strong><span>Submit</span></div>
          <div className="organization-step"><strong>2</strong><span>Review</span></div>
          <div className="organization-step"><strong>3</strong><span>Activate</span></div>
        </div>

        <nav className="organization-tabs" aria-label="Organization applications">
          <button className={view === "apply" ? "active" : ""} onClick={() => setView("apply")}>New application</button>
          <button className={view === "applications" ? "active" : ""} onClick={() => { setView("applications"); void loadApplications(); }}>My applications <span>{applications.length}</span></button>
        </nav>

        {message && <div className="organization-notice success" role="status">{message}</div>}
        {!accessToken && <div className="organization-notice preview" role="status">You can explore and complete the form in preview mode. Sign in is still required to submit or view private applications.</div>}
        {errorMessage && <div className="organization-notice error" role="alert">{errorMessage}</div>}

        {view === "apply" ? (
          <form className="organization-form" onSubmit={handleSubmit}>
            <section className="organization-card">
              <div className="organization-card-heading">
                <span>01</span><div><h2>Organization details</h2><p>Tell us about the organization requesting an EcoTrack workspace.</p></div>
              </div>
              <div className="organization-grid">
                <label className="wide">Organization name<input name="name" required minLength={2} placeholder="e.g. Green Colombo Society" /></label>
                <label>Registration number<input name="registrationNumber" placeholder="Optional" /></label>
                <label>Official email<input name="officialEmail" type="email" required placeholder="office@example.org" /></label>
                <label>Official phone<input name="officialPhone" required placeholder="+94 77 123 4567" /></label>
                <label className="wide">Official address<textarea name="officialAddress" required minLength={5} rows={3} /></label>
                <label className="wide">Description<textarea name="description" rows={4} placeholder="What does your organization do?" /></label>
              </div>
            </section>

            <section className="organization-card">
              <div className="organization-card-heading">
                <span>02</span><div><h2>Service areas</h2><p>Select the official Grama Niladhari Divisions covered by the organization.</p></div>
              </div>
              <div className="gn-area-selector">
                <label>
                  Search by GN Division, DS Division, district, or official code
                  <input
                    type="search"
                    value={areaSearch}
                    onChange={(event) => setAreaSearch(event.target.value)}
                    placeholder="e.g. Kesbewa or Mampe"
                    disabled={!accessToken}
                  />
                </label>

                <p className="gn-selection-summary">
                  {selectedAreaIds.length} GN {selectedAreaIds.length === 1 ? "Division" : "Divisions"} selected
                </p>

                <div className="gn-area-results" aria-live="polite">
                  {isLoadingAreas ? (
                    <p>Loading official GN Divisions…</p>
                  ) : availableAreas.length === 0 ? (
                    <p>
                      {accessToken
                        ? "No matching GN Divisions were found."
                        : "Sign in to search official GN Divisions."}
                    </p>
                  ) : (
                    availableAreas.map((area) => {
                      const isSelected = selectedAreaIds.includes(area.id);

                      return (
                        <label className="gn-area-option" key={area.id}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              setSelectedAreaIds((current) =>
                                current.includes(area.id)
                                  ? current.filter((id) => id !== area.id)
                                  : [...current, area.id],
                              );
                            }}
                          />
                          <span>
                            <strong>{area.name}</strong>
                            <small>
                              {[area.divisionalSecretariatName, area.districtName]
                                .filter(Boolean)
                                .join(" · ")} · Code {area.officialCode}
                            </small>
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            </section>

            <div className="organization-submit">
              <p>Submission links official GN boundaries as pending records. An administrator must review and activate the organization.</p>
              <button type="submit" disabled={isSubmitting}>{isSubmitting ? "Submitting…" : "Submit application"}</button>
            </div>
          </form>
        ) : (
          <section className="organization-applications" aria-live="polite">
            {isLoadingApplications ? (
              <div className="organization-empty">Loading your applications…</div>
            ) : applications.length === 0 ? (
              <div className="organization-empty"><h2>No applications yet</h2><p>Your submitted organizations will appear here.</p><button onClick={() => setView("apply")}>Start an application</button></div>
            ) : (
              applications.map((application) => (
                <article className="application-card" key={application.id}>
                  <div className="application-card-top"><div><span className="application-date">Submitted {new Date(application.createdAt).toLocaleDateString()}</span><h2>{application.name}</h2></div><span className={`application-status ${application.status.toLowerCase()}`}>{statusLabel(application.status)}</span></div>
                  <p>{application.description ?? "No description provided."}</p>
                  <dl><div><dt>Official email</dt><dd>{application.officialEmail}</dd></div><div><dt>Service areas</dt><dd>{application.serviceAreas.map((area) => area.areaName).join(", ")}</dd></div></dl>
                  {application.reviewNotes && <div className="review-note"><strong>Review note</strong><p>{application.reviewNotes}</p></div>}
                </article>
              ))
            )}
          </section>
        )}
      </section>
    </main>
  );
}
