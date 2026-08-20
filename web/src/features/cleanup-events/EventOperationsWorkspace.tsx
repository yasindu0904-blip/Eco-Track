import { useCallback, useEffect, useState } from "react";

import { describeApiFailure } from "../../api/apiError";
import {
  addEventNote,
  cancelCleanupEvent,
  completeCleanupEvent,
  getEventCompletionReadiness,
  getEventOperations,
  transitionEventSessionStatus,
  transitionEventStatus,
  uploadEventEvidence,
} from "./cleanupEvent.api";
import type { EventCompletionReadiness, EventOperations } from "./cleanupEvent.types";

type Props = { accessToken: string; organizationId: string; eventId: string; canCancel: boolean; onChanged?: () => void };

export function EventOperationsWorkspace({ accessToken, organizationId, eventId, canCancel, onChanged }: Props) {
  const [data, setData] = useState<EventOperations>();
  const [readiness, setReadiness] = useState<EventCompletionReadiness>();
  const [noteText, setNoteText] = useState("");
  const [visibility, setVisibility] = useState<"PARTICIPANTS" | "INTERNAL">("PARTICIPANTS");
  const [file, setFile] = useState<File>();
  const [evidenceType, setEvidenceType] = useState<"BEFORE" | "PROGRESS" | "AFTER">("PROGRESS");
  const [evidenceSessionId, setEvidenceSessionId] = useState("");
  const [caption, setCaption] = useState("");
  const [cancellationReason, setCancellationReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    setError(undefined);
    try {
      const operations = await getEventOperations(accessToken, organizationId, eventId);
      setData(operations);
      setReadiness(operations.availableTransitions.some(({ lifecycleStatus }) => lifecycleStatus === "COMPLETED")
        ? await getEventCompletionReadiness(accessToken, organizationId, eventId)
        : undefined);
    } catch (reason) { setError(describeApiFailure(reason, "Unable to load event operations.").message); }
  }, [accessToken, eventId, organizationId]);

  useEffect(() => { const timeout = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timeout); }, [load]);

  async function run(operation: () => Promise<unknown>, success: string) {
    setBusy(true); setError(undefined); setMessage(undefined);
    try { await operation(); setMessage(success); await load(); onChanged?.(); }
    catch (reason) { setError(describeApiFailure(reason, "The event operation could not be completed.").message); }
    finally { setBusy(false); }
  }

  if (!data) return <section className="event-editor-panel"><h2>Event operations</h2><p>{error ?? "Loading operations…"}</p></section>;
  const terminal = data.event.lifecycleStatus === "COMPLETED" || data.event.lifecycleStatus === "CANCELLED";

  return <section className="event-operations" aria-label="Event operations">
    <header className="event-operations-heading"><div><span>LIVE OPERATIONS</span><h2>{data.event.currentWorkflowStatus.label}</h2><p>Protected notes, evidence, sessions, and lifecycle history.</p></div><button className="secondary" disabled={busy} type="button" onClick={() => void load()}>Refresh</button></header>
    {error && <p className="event-editor-notice error" role="alert">{error}</p>}{message && <p className="event-editor-notice">{message}</p>}
    {!terminal && <div className="event-operations-grid"><section className="event-editor-panel"><h3>Post an update</h3><label>Visibility<select value={visibility} onChange={(event) => setVisibility(event.target.value as typeof visibility)}><option value="PARTICIPANTS">Participants</option><option value="INTERNAL">Internal team only</option></select></label><label>Note<textarea value={noteText} maxLength={2000} onChange={(event) => setNoteText(event.target.value)} /></label><button disabled={busy || !noteText.trim()} type="button" onClick={() => void run(async () => { await addEventNote(accessToken, organizationId, eventId, visibility, noteText); setNoteText(""); }, "Event note added.")}>Add note</button></section>
      <section className="event-editor-panel"><h3>Upload evidence</h3><label>Evidence type<select value={evidenceType} onChange={(event) => setEvidenceType(event.target.value as typeof evidenceType)}><option value="BEFORE">Before</option><option value="PROGRESS">Progress</option><option value="AFTER">After</option></select></label><label>Session (optional)<select value={evidenceSessionId} onChange={(event) => setEvidenceSessionId(event.target.value)}><option value="">Whole event</option>{data.sessions.map((session) => <option key={session.id} value={session.id}>{session.sessionDate} · {session.startTime.slice(0, 5)}</option>)}</select></label><label>Caption<input value={caption} maxLength={500} onChange={(event) => setCaption(event.target.value)} /></label><label>Photo<input accept="image/jpeg,image/png,image/webp" type="file" onChange={(event) => setFile(event.target.files?.[0])} /></label><button disabled={busy || !file} type="button" onClick={() => file && void run(async () => { await uploadEventEvidence(accessToken, organizationId, eventId, file, { type: evidenceType, sessionId: evidenceSessionId || null, caption: caption || null }); setFile(undefined); setCaption(""); }, "Evidence uploaded and recorded.")}>Upload evidence</button></section></div>}
    <section className="event-editor-panel"><h3>Sessions</h3><div className="event-editor-item-list">{data.sessions.map((session) => <article key={session.id}><span><strong>{session.sessionDate} · {session.startTime.slice(0, 5)}–{session.endTime.slice(0, 5)}</strong><small>{session.status.replaceAll("_", " ")}</small></span>{!terminal && <span className="event-operations-actions">{session.status === "SCHEDULED" && <><button disabled={busy} type="button" onClick={() => void run(() => transitionEventSessionStatus(accessToken, organizationId, eventId, session.id, "IN_PROGRESS", session.updatedAt), "Session started.")}>Start</button><button className="danger" disabled={busy} type="button" onClick={() => void run(() => transitionEventSessionStatus(accessToken, organizationId, eventId, session.id, "CANCELLED", session.updatedAt), "Session cancelled.")}>Cancel</button></>}{session.status === "IN_PROGRESS" && <><button disabled={busy} type="button" onClick={() => void run(() => transitionEventSessionStatus(accessToken, organizationId, eventId, session.id, "COMPLETED", session.updatedAt), "Session completed.")}>Complete</button><button className="danger" disabled={busy} type="button" onClick={() => void run(() => transitionEventSessionStatus(accessToken, organizationId, eventId, session.id, "CANCELLED", session.updatedAt), "Session cancelled.")}>Cancel</button></>}</span>}</article>)}</div></section>
    {!terminal && <section className="event-editor-panel"><h3>Event lifecycle</h3><div className="event-operations-actions">{data.availableTransitions.filter(({ lifecycleStatus }) => !["CANCELLED", "COMPLETED", "PUBLISHED"].includes(lifecycleStatus)).map((target) => <button disabled={busy} key={target.id} type="button" onClick={() => void run(() => transitionEventStatus(accessToken, organizationId, eventId, target.id, data.event.updatedAt), `Event moved to ${target.label}.`)}>Move to {target.label}</button>)}</div>{readiness && <div className="event-readiness"><h4>Completion readiness</h4>{readiness.checks.map((check) => <p className={check.ready ? "ready" : "blocked"} key={check.code}>{check.ready ? "✓" : "!"} {check.message}</p>)}<button disabled={busy || !readiness.ready} type="button" onClick={() => window.confirm("Complete this cleanup event and resolve its linked incident?") && void run(() => completeCleanupEvent(accessToken, organizationId, eventId, data.event.updatedAt), "Cleanup event completed.")}>Complete cleanup event</button></div>}{canCancel && data.availableTransitions.some(({ lifecycleStatus }) => lifecycleStatus === "CANCELLED") && <div className="event-cancellation"><label>Cancellation reason<textarea value={cancellationReason} onChange={(event) => setCancellationReason(event.target.value)} /></label><button className="danger" disabled={busy || cancellationReason.trim().length < 10} type="button" onClick={() => window.confirm("Cancel this event and notify its participants?") && void run(() => cancelCleanupEvent(accessToken, organizationId, eventId, data.event.updatedAt, cancellationReason), "Cleanup event cancelled.")}>Cancel cleanup event</button></div>}</section>}
    <div className="event-operations-grid"><section className="event-editor-panel"><h3>Notes</h3>{data.notes.length === 0 ? <p>No operational notes yet.</p> : data.notes.map((note) => <article className="event-operation-entry" key={note.id}><strong>{note.visibility === "INTERNAL" ? "Internal" : "Participants"}</strong><p>{note.noteText}</p><small>{note.author.fullName ?? "Organization member"} · {new Date(note.createdAt).toLocaleString()}</small></article>)}</section><section className="event-editor-panel"><h3>Evidence</h3>{data.evidence.length === 0 ? <p>No evidence uploaded yet.</p> : <div className="event-evidence-gallery">{data.evidence.map((item) => <figure key={item.id}><img alt={item.caption ?? `${item.type.toLowerCase()} cleanup evidence`} src={item.url} /><figcaption><strong>{item.type}</strong><span>{item.caption}</span></figcaption></figure>)}</div>}</section></div>
    <section className="event-editor-panel"><h3>Status timeline</h3>{data.history.map((entry) => <article className="event-operation-entry" key={entry.id}><strong>{entry.fromStatus?.label ?? "Created"} → {entry.toStatus.label}</strong><p>{entry.notes}</p><small>{entry.changedBy.fullName ?? "Organization member"} · {new Date(entry.changedAt).toLocaleString()}</small></article>)}</section>
  </section>;
}
