import { useCallback, useEffect, useState } from "react";
import { describeApiFailure } from "../../api/apiError";
import {
  addEventNote,
  cancelCleanupEvent,
  completeCleanupEvent,
  getEventCompletionReadiness,
  getEventOperations,
  uploadEventEvidence,
} from "./cleanupEvent.api";
import type {
  EventCompletionReadiness,
  EventOperations,
} from "./cleanupEvent.types";

type Props = {
  accessToken: string;
  organizationId: string;
  eventId: string;
  canCancel: boolean;
  onChanged?: () => void;
};
export function EventOperationsWorkspace({
  accessToken,
  organizationId,
  eventId,
  canCancel,
  onChanged,
}: Props) {
  const [data, setData] = useState<EventOperations>();
  const [readiness, setReadiness] = useState<EventCompletionReadiness>();
  const [noteText, setNoteText] = useState("");
  const [visibility, setVisibility] = useState<"PARTICIPANTS" | "INTERNAL">(
    "PARTICIPANTS",
  );
  const [file, setFile] = useState<File>();
  const [evidenceType, setEvidenceType] = useState<
    "BEFORE" | "PROGRESS" | "AFTER"
  >("PROGRESS");
  const [caption, setCaption] = useState("");
  const [cancellationReason, setCancellationReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const load = useCallback(async () => {
    setError(undefined);
    try {
      const operations = await getEventOperations(
        accessToken,
        organizationId,
        eventId,
      );
      setData(operations);
      setReadiness(
        operations.event.lifecycleStatus === "PUBLISHED"
          ? await getEventCompletionReadiness(
              accessToken,
              organizationId,
              eventId,
            )
          : undefined,
      );
    } catch (reason) {
      setError(
        describeApiFailure(reason, "Unable to load event operations.").message,
      );
    }
  }, [accessToken, eventId, organizationId]);
  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);
  async function run(operation: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError(undefined);
    setMessage(undefined);
    try {
      await operation();
      setMessage(success);
      await load();
      onChanged?.();
    } catch (reason) {
      setError(
        describeApiFailure(
          reason,
          "The event operation could not be completed.",
        ).message,
      );
    } finally {
      setBusy(false);
    }
  }
  if (!data)
    return (
      <section className="event-editor-panel">
        <h2>Event operations</h2>
        <p>{error ?? "Loading operations…"}</p>
      </section>
    );
  const terminal =
    data.event.lifecycleStatus === "COMPLETED" ||
    data.event.lifecycleStatus === "CANCELLED";
  return (
    <section className="event-operations" aria-label="Event operations">
      <header className="event-operations-heading">
        <div>
          <span>EVENT OPERATIONS</span>
          <h2>{data.event.currentWorkflowStatus.label}</h2>
          <p>
            Post updates, record evidence, then complete or cancel the event.
          </p>
        </div>
        <button
          className="secondary"
          disabled={busy}
          type="button"
          onClick={() => void load()}
        >
          Refresh
        </button>
      </header>
      {error && (
        <p className="event-editor-notice error" role="alert">
          {error}
        </p>
      )}
      {message && <p className="event-editor-notice">{message}</p>}
      {!terminal && (
        <div className="event-operations-grid">
          <section className="event-editor-panel">
            <h3>Post an update</h3>
            <label>
              Visibility
              <select
                value={visibility}
                onChange={(event) =>
                  setVisibility(event.target.value as typeof visibility)
                }
              >
                <option value="PARTICIPANTS">Participants</option>
                <option value="INTERNAL">Internal team only</option>
              </select>
            </label>
            <label>
              Note
              <textarea
                value={noteText}
                maxLength={2000}
                onChange={(event) => setNoteText(event.target.value)}
              />
            </label>
            <button
              disabled={busy || !noteText.trim()}
              type="button"
              onClick={() =>
                void run(async () => {
                  await addEventNote(
                    accessToken,
                    organizationId,
                    eventId,
                    visibility,
                    noteText,
                  );
                  setNoteText("");
                }, "Event note added.")
              }
            >
              Add note
            </button>
          </section>
          <section className="event-editor-panel">
            <h3>Upload evidence</h3>
            <label>
              Evidence type
              <select
                value={evidenceType}
                onChange={(event) =>
                  setEvidenceType(event.target.value as typeof evidenceType)
                }
              >
                <option value="BEFORE">Before</option>
                <option value="PROGRESS">Progress</option>
                <option value="AFTER">After</option>
              </select>
            </label>
            <label>
              Caption
              <input
                value={caption}
                maxLength={500}
                onChange={(event) => setCaption(event.target.value)}
              />
            </label>
            <label>
              Photo
              <input
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                type="file"
                onChange={(event) => setFile(event.target.files?.[0])}
              />
            </label>
            <button
              disabled={busy || !file}
              type="button"
              onClick={() =>
                file &&
                void run(async () => {
                  await uploadEventEvidence(
                    accessToken,
                    organizationId,
                    eventId,
                    file,
                    { type: evidenceType, caption: caption || null },
                  );
                  setFile(undefined);
                  setCaption("");
                }, "Evidence uploaded and recorded.")
              }
            >
              Upload evidence
            </button>
          </section>
        </div>
      )}
      {!terminal && (
        <section className="event-editor-panel">
          <h3>Finish the event</h3>
          {readiness && (
            <div className="event-readiness">
              {readiness.checks.map((check) => (
                <p
                  className={check.ready ? "ready" : "blocked"}
                  key={check.code}
                >
                  {check.ready ? "✓" : "!"} {check.message}
                </p>
              ))}
              <button
                disabled={busy || !readiness.ready}
                type="button"
                onClick={() =>
                  window.confirm(
                    "Complete this cleanup event? Any linked incident will be resolved.",
                  ) &&
                  void run(
                    () =>
                      completeCleanupEvent(
                        accessToken,
                        organizationId,
                        eventId,
                        data.event.updatedAt,
                      ),
                    "Cleanup event completed.",
                  )
                }
              >
                Complete cleanup event
              </button>
            </div>
          )}
          {canCancel && (
            <div className="event-cancellation">
              <label>
                Cancellation reason
                <textarea
                  value={cancellationReason}
                  onChange={(event) =>
                    setCancellationReason(event.target.value)
                  }
                />
              </label>
              <button
                className="danger"
                disabled={busy || cancellationReason.trim().length < 10}
                type="button"
                onClick={() =>
                  window.confirm("Cancel this event and notify volunteers?") &&
                  void run(
                    () =>
                      cancelCleanupEvent(
                        accessToken,
                        organizationId,
                        eventId,
                        data.event.updatedAt,
                        cancellationReason,
                      ),
                    "Cleanup event cancelled.",
                  )
                }
              >
                Cancel cleanup event
              </button>
            </div>
          )}
        </section>
      )}
      <div className="event-operations-grid">
        <section className="event-editor-panel">
          <h3>Notes</h3>
          {data.notes.length === 0 ? (
            <p>No operational notes yet.</p>
          ) : (
            data.notes.map((note) => (
              <article className="event-operation-entry" key={note.id}>
                <strong>
                  {note.visibility === "INTERNAL" ? "Internal" : "Participants"}
                </strong>
                <p>{note.noteText}</p>
                <small>
                  {note.author.fullName ?? "Organization member"} ·{" "}
                  {new Date(note.createdAt).toLocaleString()}
                </small>
              </article>
            ))
          )}
        </section>
        <section className="event-editor-panel">
          <h3>Evidence</h3>
          {data.evidence.length === 0 ? (
            <p>No evidence uploaded yet.</p>
          ) : (
            <div className="event-evidence-gallery">
              {data.evidence.map((item) => (
                <figure key={item.id}>
                  <img
                    alt={
                      item.caption ??
                      `${item.type.toLowerCase()} cleanup evidence`
                    }
                    src={item.url}
                  />
                  <figcaption>
                    <strong>{item.type}</strong>
                    <span>{item.caption}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </section>
      </div>
      <section className="event-editor-panel">
        <h3>Status timeline</h3>
        {data.history.map((entry) => (
          <article className="event-operation-entry" key={entry.id}>
            <strong>
              {entry.fromStatus?.label ?? "Created"} → {entry.toStatus.label}
            </strong>
            <p>{entry.notes}</p>
            <small>
              {entry.changedBy.fullName ?? "Organization member"} ·{" "}
              {new Date(entry.changedAt).toLocaleString()}
            </small>
          </article>
        ))}
      </section>
    </section>
  );
}
