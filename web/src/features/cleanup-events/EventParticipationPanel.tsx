import { useInvalidateLists } from "../../components/lists/usePagedList";
import { useCallback, useEffect, useState } from "react";
import { describeApiFailure } from "../../api/apiError";
import {
  getMyEventParticipation,
  joinCleanupEvent,
  withdrawFromCleanupEvent,
} from "./cleanupEvent.api";
import type {
  CleanupEventPublicDetail,
  EventParticipation,
} from "./cleanupEvent.types";

type Props = {
  accessToken: string;
  event: CleanupEventPublicDetail;
  onChanged?: (value: EventParticipation | null) => void;
};

export function EventParticipationPanel({
  accessToken,
  event,
  onChanged,
}: Props) {
  const invalidateLists = useInvalidateLists();
  const [participation, setParticipation] = useState<EventParticipation | null>(
    null,
  );
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [renderedAt] = useState(Date.now);

  const load = useCallback(async () => {
    setError(undefined);
    try {
      const value = await getMyEventParticipation(accessToken, event.id);
      setParticipation(value);
      onChanged?.(value);
    } catch (reason) {
      setError(
        describeApiFailure(reason, "Unable to load your participation.")
          .message,
      );
    } finally {
      setBusy(false);
    }
  }, [accessToken, event.id, onChanged]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  async function volunteer(): Promise<void> {
    setBusy(true);
    setError(undefined);
    setMessage(undefined);
    try {
      const saved = (await joinCleanupEvent(accessToken, event.id))
        .participation;
      invalidateLists("joined:");
      setParticipation(saved);
      setMessage(
        participation?.status === "WITHDRAWN"
          ? "You rejoined this cleanup event."
          : "You are now volunteering for this cleanup event.",
      );
      onChanged?.(saved);
    } catch (reason) {
      setError(
        describeApiFailure(reason, "Unable to join this cleanup event.")
          .message,
      );
    } finally {
      setBusy(false);
    }
  }

  async function withdraw(): Promise<void> {
    if (!window.confirm("Withdraw from this cleanup event?")) return;
    setBusy(true);
    setError(undefined);
    setMessage(undefined);
    try {
      const saved = await withdrawFromCleanupEvent(accessToken, event.id);
      invalidateLists("joined:");
      setParticipation(saved);
      setMessage("You have withdrawn from this event.");
      onChanged?.(saved);
    } catch (reason) {
      setError(
        describeApiFailure(reason, "Unable to withdraw from this event.")
          .message,
      );
    } finally {
      setBusy(false);
    }
  }

  const active = participation?.status === "JOINED";
  const removed = participation?.status === "REMOVED";
  const open =
    event.lifecycleStatus === "PUBLISHED" &&
    new Date(event.startsAt).getTime() > renderedAt;

  return (
    <section
      className="event-participation"
      aria-labelledby="participation-title"
    >
      <div className="event-participation-heading">
        <div>
          <span className="event-participation-eyebrow">VOLUNTEER</span>
          <h3 id="participation-title">
            {active ? "You are volunteering" : "Join this cleanup"}
          </h3>

        </div>
      </div>
      {participation && (
        <span
          className={`participation-status ${participation.status.toLowerCase()}`}
        >
          {participation.status}
        </span>
      )}
      {active && (
        <p>
          <strong>Attendance:</strong>{" "}
          {participation.attendanceStatus === "UNMARKED"
            ? "Not marked yet"
            : participation.attendanceStatus}
        </p>
      )}
      {error && (
        <p className="event-editor-notice error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="event-editor-notice" role="status">
          {message}
        </p>
      )}
      {removed ? (
        <p className="event-editor-notice error">
          The event team removed this participation.
        </p>
      ) : (
        <div className="event-editor-actions">
          {!active && open && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void volunteer()}
            >
              {busy
                ? "Joining…"
                : participation?.status === "WITHDRAWN"
                  ? "Volunteer again"
                  : "Volunteer"}
            </button>
          )}
          {active && participation.attendanceStatus === "UNMARKED" && (
            <button
              type="button"
              className="danger"
              disabled={busy}
              onClick={() => void withdraw()}
            >
              Withdraw
            </button>
          )}
          {!active && !open && (
            <p className="event-editor-notice">
              This event is not open for new volunteers.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
