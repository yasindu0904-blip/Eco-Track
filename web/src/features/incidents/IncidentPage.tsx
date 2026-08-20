import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";

import { COLOMBO_MAP_CENTER, LocationPicker, type MapLocation } from "../maps";
import type { AuthenticatedUserProfile } from "../auth/auth.types";
import {
  createIncident,
  getMyIncident,
  listIncidentCategories,
  listMyIncidents,
  uploadIncidentEvidence,
} from "./incident.api";
import type {
  IncidentCategory,
  IncidentDetail,
  IncidentSeverity,
  IncidentStatus,
  IncidentSummary,
  UploadedIncidentEvidence,
} from "./incident.types";
import { CitizenIncidentDiscovery } from "./CitizenIncidentDiscovery";
import "./incident.css";

type IncidentView = "create" | "reports" | "detail" | "discover";
type IncidentNotification = {
  kind: "success" | "error";
  message: string;
};

interface IncidentPageProps {
  accessToken: string;
  profile: AuthenticatedUserProfile;
  initialView?: "create" | "reports" | "discover";
  initialIncidentId?: string;
  onBackToDashboard: () => void;
  onSignOut?: () => void;
  onOpenCleanupEvent?: (eventId: string) => void;
}

const severityOptions: Array<{ value: IncidentSeverity; label: string; help: string }> = [
  { value: "LOW", label: "Low", help: "Limited impact" },
  { value: "MEDIUM", label: "Medium", help: "Needs attention" },
  { value: "HIGH", label: "High", help: "Serious local hazard" },
  { value: "CRITICAL", label: "Critical", help: "Immediate danger" },
];

function readableStatus(status: IncidentStatus): string {
  return status.toLowerCase().split("_").map((word) =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(" ");
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function IncidentPage({
  accessToken,
  profile,
  initialView = "create",
  initialIncidentId,
  onBackToDashboard,
  onSignOut,
  onOpenCleanupEvent,
}: IncidentPageProps) {
  const [view, setView] = useState<IncidentView>(initialView);
  const [categories, setCategories] = useState<IncidentCategory[]>([]);
  const [reports, setReports] = useState<IncidentSummary[]>([]);
  const [detail, setDetail] = useState<IncidentDetail | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [severity, setSeverity] = useState<IncidentSeverity>("MEDIUM");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [addressText, setAddressText] = useState("");
  const [location, setLocation] = useState<MapLocation>(COLOMBO_MAP_CENTER);
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadedEvidence, setUploadedEvidence] = useState<UploadedIncidentEvidence[]>([]);
  const [submissionId, setSubmissionId] = useState(() => crypto.randomUUID());
  const [isLoading, setIsLoading] = useState(initialView === "reports");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [notification, setNotification] = useState<IncidentNotification | null>(null);

  useEffect(() => {
    if (!notification) return;
    const timeout = window.setTimeout(
      () => setNotification(null),
      notification.kind === "success" ? 5000 : 7000,
    );
    return () => window.clearTimeout(timeout);
  }, [notification]);

  useEffect(() => {
    if (!initialIncidentId || initialView !== "reports") return;
    void openReport(initialIncidentId);
    // The destination ID is intentionally consumed once when this route mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialIncidentId, initialView]);

  useEffect(() => {
    let active = true;
    void listIncidentCategories(accessToken)
      .then((loaded) => {
        if (!active) return;
        setCategories(loaded);
        setCategoryId((current) => current || loaded[0]?.id || "");
      })
      .catch((error: unknown) => {
        if (active) setNotification({ kind: "error", message: error instanceof Error ? error.message : "Could not load incident categories." });
      });
    return () => { active = false; };
  }, [accessToken]);

  useEffect(() => {
    if (view !== "reports") return;
    let active = true;
    void listMyIncidents(accessToken)
      .then((loaded) => { if (active) setReports(loaded); })
      .catch((error: unknown) => {
        if (active) setNotification({ kind: "error", message: error instanceof Error ? error.message : "Could not load your reports." });
      })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [accessToken, view]);

  function chooseFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    const invalid = selected.find((file) =>
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024
    );
    if (selected.length > 5) {
      setNotification({ kind: "error", message: "Choose no more than 5 photos." });
      event.target.value = "";
      return;
    }
    if (invalid) {
      setNotification({ kind: "error", message: `${invalid.name} must be a JPEG, PNG, or WebP image no larger than 8 MB.` });
      event.target.value = "";
      return;
    }
    setFiles(selected);
    setUploadedEvidence([]);
    setNotification(null);
  }

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!locationConfirmed) {
      setNotification({ kind: "error", message: "Confirm the incident location on the map before submitting." });
      return;
    }
    if (!categoryId) {
      setNotification({ kind: "error", message: "Select an incident category." });
      return;
    }
    setIsSubmitting(true);
    setNotification(null);
    try {
      let evidence = uploadedEvidence;
      if (files.length > 0 && evidence.length !== files.length) {
        evidence = await uploadIncidentEvidence(
          accessToken,
          submissionId,
          files,
          (completed, total, fileName) => {
            setUploadProgress(`Uploading ${fileName} — ${completed} of ${total} complete`);
          },
        );
        setUploadedEvidence(evidence);
      }
      setUploadProgress("Saving your report safely…");
      const result = await createIncident(accessToken, {
        submissionId,
        categoryId,
        title,
        description,
        severity,
        latitude: location.latitude,
        longitude: location.longitude,
        addressText: addressText.trim() || undefined,
        evidence,
      });
      setDetail(result.incident);
      setView("detail");
      setNotification(result.idempotentReplay
        ? { kind: "error", message: "This report was already submitted. The existing report is shown." }
        : { kind: "success", message: "Incident report submitted successfully." });
    } catch (error) {
      setNotification({ kind: "error", message: error instanceof Error ? error.message : "The incident could not be submitted." });
    } finally {
      setUploadProgress(null);
      setIsSubmitting(false);
    }
  }

  async function openReport(id: string) {
    setIsLoading(true);
    setNotification(null);
    try {
      setDetail(await getMyIncident(accessToken, id));
      setView("detail");
    } catch (error) {
      setNotification({ kind: "error", message: error instanceof Error ? error.message : "The report could not be loaded." });
    } finally {
      setIsLoading(false);
    }
  }

  function startAnotherReport() {
    setTitle("");
    setDescription("");
    setAddressText("");
    setSeverity("MEDIUM");
    setLocation(COLOMBO_MAP_CENTER);
    setLocationConfirmed(false);
    setFiles([]);
    setUploadedEvidence([]);
    setSubmissionId(crypto.randomUUID());
    setDetail(null);
    setNotification(null);
    setView("create");
  }

  return (
    <main className="incident-shell">
      {notification && (
        <div
          className={`incident-toast ${notification.kind}`}
          role={notification.kind === "error" ? "alert" : "status"}
          aria-live={notification.kind === "error" ? "assertive" : "polite"}
        >
          <span className="incident-toast-icon" aria-hidden="true">
            {notification.kind === "success" ? "✓" : "!"}
          </span>
          <span>{notification.message}</span>
          <button type="button" aria-label="Dismiss notification" onClick={() => setNotification(null)}>×</button>
        </div>
      )}
      <header className="incident-header">
        <div className="incident-header-start">
          <button type="button" className="incident-back" onClick={onBackToDashboard}>← Dashboard</button>
          <div><strong>EcoTrack</strong><small>Incident reporting</small></div>
        </div>
        <nav aria-label="Incident navigation">
          <button type="button" className={view === "create" ? "active" : ""} onClick={startAnotherReport}>Report incident</button>
          <button type="button" className={view === "reports" || view === "detail" ? "active" : ""} onClick={() => setView("reports")}>My Reports</button>
        </nav>
        <div className="incident-profile"><span>{profile.fullName ?? profile.email}</span>{onSignOut && <button type="button" onClick={onSignOut}>Sign out</button>}</div>
      </header>

      <section className="incident-content">
        {view === "create" && (
          <>
            <div className="incident-intro">
              <div><span>COMMUNITY REPORT</span><h1>Report an environmental incident</h1><p>Share clear details and confirm the exact location so nearby organizations can respond appropriately.</p></div>
              <div className="incident-safety-note"><strong>One shared report</strong><p>EcoTrack finds covering organizations. You do not need to choose one.</p></div>
            </div>
            <form className="incident-form" onSubmit={(event) => void submitReport(event)}>
              <section className="incident-card">
                <div className="incident-card-title"><span>01</span><div><h2>What did you find?</h2><p>Select the category and urgency that best describe the issue.</p></div></div>
                <div className="incident-category-grid">
                  {categories.map((category) => (
                    <button key={category.id} type="button" className={categoryId === category.id ? "selected" : ""} onClick={() => setCategoryId(category.id)}>
                      <strong>{category.name}</strong><small>{category.description}</small>
                    </button>
                  ))}
                </div>
                <fieldset className="incident-severity"><legend>Severity</legend><div>{severityOptions.map((option) => <label key={option.value} className={severity === option.value ? `selected severity-${option.value.toLowerCase()}` : ""}><input type="radio" name="severity" value={option.value} checked={severity === option.value} onChange={() => setSeverity(option.value)} /><strong>{option.label}</strong><small>{option.help}</small></label>)}</div></fieldset>
              </section>

              <section className="incident-card">
                <div className="incident-card-title"><span>02</span><div><h2>Describe the incident</h2><p>Use specific, factual information that helps reviewers understand the problem.</p></div></div>
                <div className="incident-fields">
                  <label>Incident title<input required minLength={3} maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Plastic waste blocking the canal" /></label>
                  <label>Description<textarea required minLength={10} maxLength={5000} rows={6} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe what you saw, the size of the affected area, and any immediate hazards…" /></label>
                  <label>Address or landmark <span>(optional)</span><input maxLength={500} value={addressText} onChange={(event) => setAddressText(event.target.value)} placeholder="e.g. Near the west entrance of Viharamahadevi Park" /></label>
                </div>
              </section>

              <section className="incident-card">
                <div className="incident-card-title"><span>03</span><div><h2>Confirm the location</h2><p>Use the location button or move the map beneath the center pin, then confirm it.</p></div></div>
                <LocationPicker
                  value={location}
                  disabled={isSubmitting}
                  confirmLabel={locationConfirmed ? "✓ Location confirmed" : "Confirm incident location"}
                  onChange={(next) => { setLocation(next); setLocationConfirmed(false); }}
                  onConfirm={(next) => { setLocation(next); setLocationConfirmed(true); }}
                />
              </section>

              <section className="incident-card">
                <div className="incident-card-title"><span>04</span><div><h2>Add photo evidence</h2><p>Optional for web. Add up to 5 JPEG, PNG, or WebP photos, 8 MB each.</p></div></div>
                <label className="incident-upload"><input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={isSubmitting} onChange={chooseFiles} /><span>＋ Choose photos</span><small>Clear, well-lit images help organizations review the report.</small></label>
                {files.length > 0 && <ul className="incident-file-list">{files.map((file) => <li key={`${file.name}-${file.lastModified}`}><span>{file.name}</span><small>{(file.size / 1024 / 1024).toFixed(1)} MB</small></li>)}</ul>}
              </section>

              <div className="incident-submit-bar"><div><strong>{locationConfirmed ? "Location confirmed" : "Location confirmation required"}</strong><small>{uploadProgress ?? "Your report remains editable until submission."}</small></div><button type="submit" disabled={isSubmitting || categories.length === 0}>{isSubmitting ? "Submitting…" : "Submit incident report"}</button></div>
            </form>
          </>
        )}

        {view === "reports" && (
          <section className="incident-reports-view">
            <div className="incident-list-heading"><div><span>YOUR ACTIVITY</span><h1>My Reports</h1><p>Follow the shared status of environmental incidents you reported.</p></div><button type="button" onClick={startAnotherReport}>＋ New report</button></div>
            {isLoading ? <div className="incident-empty">Loading your reports…</div> : reports.length === 0 ? <div className="incident-empty"><h2>No incident reports yet</h2><p>Your submitted reports will appear here.</p><button type="button" onClick={startAnotherReport}>Report an incident</button></div> : <div className="incident-report-grid">{reports.map((report) => <article key={report.id} className="incident-report-card">{report.thumbnailUrl ? <img src={report.thumbnailUrl} alt="" /> : <div className="incident-photo-placeholder">Environmental report</div>}<div className="incident-report-body"><div className="incident-report-meta"><span>{report.category.name}</span><span className={`status-${report.status.toLowerCase()}`}>{readableStatus(report.status)}</span></div><h2>{report.title}</h2><p>{report.addressText ?? `${report.latitude.toFixed(5)}, ${report.longitude.toFixed(5)}`}</p><div><small>{formatDate(report.reportedAt)}</small><strong>{readableStatus(report.severity as IncidentStatus)} severity</strong></div><button type="button" onClick={() => void openReport(report.id)}>View report →</button></div></article>)}</div>}
          </section>
        )}

        {view === "detail" && detail && (
          <section className="incident-detail-view">
            <button type="button" className="incident-text-back" onClick={() => setView("reports")}>← Back to My Reports</button>
            <div className="incident-detail-hero"><div><span>{detail.category.name}</span><h1>{detail.title}</h1><p>Reported {formatDate(detail.reportedAt)}</p></div><span className={`incident-detail-status status-${detail.status.toLowerCase()}`}>{readableStatus(detail.status)}</span></div>
            <div className="incident-detail-grid"><div className="incident-detail-main"><article className="incident-card"><h2>Description</h2><p className="incident-description">{detail.description}</p></article>{detail.photos.length > 0 && <article className="incident-card"><h2>Photo evidence</h2><div className="incident-gallery">{detail.photos.map((photo) => <img key={photo.id} src={photo.url} alt={photo.caption ?? "Incident evidence"} />)}</div></article>}<article className="incident-card"><h2>Status history</h2><ol className="incident-timeline">{detail.statusHistory.map((history) => <li key={history.id}><span /><div><strong>{readableStatus(history.toStatus)}</strong><small>{formatDate(history.changedAt)}</small><p>{history.reason}</p></div></li>)}</ol></article></div><aside><article className="incident-card"><h2>Location</h2><p>{detail.addressText ?? "No address supplied"}</p><strong>{detail.latitude.toFixed(6)}, {detail.longitude.toFixed(6)}</strong></article><article className="incident-card"><h2>Report details</h2><dl><div><dt>Severity</dt><dd>{readableStatus(detail.severity as IncidentStatus)}</dd></div><div><dt>Highlighted until</dt><dd>{formatDate(detail.highlightUntil)}</dd></div><div><dt>Archive after</dt><dd>{formatDate(detail.archiveAfter)}</dd></div></dl></article><button type="button" className="incident-new-button" onClick={startAnotherReport}>Report another incident</button></aside></div>
          </section>
        )}

        {view === "discover" && (
          <CitizenIncidentDiscovery accessToken={accessToken} onOpenEvent={onOpenCleanupEvent} />
        )}
      </section>
    </main>
  );
}
