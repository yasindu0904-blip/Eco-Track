import { ListWindow } from "../../components/lists/ListControls";
import { useCallback, useEffect, useState } from "react";
import { describeApiFailure } from "../../api/apiError";
import {
  listEventParticipants,
  markEventAttendance,
  removeEventParticipant,
} from "./cleanupEvent.api";
import type { EventParticipantOperationsPage } from "./cleanupEvent.types";

type Props = { accessToken: string; organizationId: string; eventId: string };

export function EventParticipantOperations({
  accessToken,
  organizationId,
  eventId,
}: Props) {
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState<EventParticipantOperationsPage>();
  const [busyKey, setBusyKey] = useState<string>();
  const [error, setError] = useState<string>();
  const [renderedAt] = useState(Date.now);
  const load = useCallback(async () => {
    setError(undefined);
    try {
      setPage(
        await listEventParticipants(accessToken, organizationId, eventId),
      );
    } catch (reason) {
      setError(
        describeApiFailure(reason, "Unable to load event volunteers.").message,
      );
    }
  }, [accessToken, eventId, organizationId]);
  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);
  const run = async (key: string, operation: () => Promise<unknown>) => {
    setBusyKey(key);
    setError(undefined);
    try {
      await operation();
      await load();
    } catch (reason) {
      setError(
        describeApiFailure(
          reason,
          "The volunteer operation could not be completed.",
        ).message,
      );
    } finally {
      setBusyKey(undefined);
    }
  };
  async function loadMore() {
    if (!page?.nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await listEventParticipants(accessToken, organizationId, eventId, "JOINED", page.nextCursor);
      setPage(current => current ? { ...next, participants: [...current.participants, ...next.participants] } : next);
    } catch (reason) { setError(describeApiFailure(reason).message); }
    finally { setLoadingMore(false); }
  }
  const attendanceOpen = Boolean(
    page?.event.startsAt &&
      new Date(page.event.startsAt).getTime() <= renderedAt,
  );

  return (
    <section className="event-participant-operations">
      <header>
        <div>
          <span>VOLUNTEERS</span>
          <h3>Attendance</h3>

        </div>
        <button type="button" className="secondary" onClick={() => void load()}>
          Refresh
        </button>
      </header>
      {error && (
        <p className="event-editor-notice error" role="alert">
          {error}
        </p>
      )}
      {!page ? (
        <p>Loading volunteers…</p>
      ) : page.participants.length === 0 ? (
        <div className="event-editor-empty">
          <strong>No joined volunteers</strong>
        </div>
      ) : (
        <ListWindow items={page.participants} hasMore={Boolean(page.nextCursor)} busy={loadingMore} loadMore={() => void loadMore()}>{visible => visible.map((participant) => (
          <article className="event-participant-card" key={participant.id}>
            <div className="event-participant-person">
              <div>
                <strong>
                  {participant.volunteer.fullName ?? "EcoTrack volunteer"}
                </strong>
                <small>
                  {participant.volunteer.phoneNumber ??
                    "No phone number provided"}
                </small>
              </div>
              <span>{participant.attendanceStatus}</span>
            </div>
            {participant.attendanceStatus === "UNMARKED" && attendanceOpen ? (
              <div className="event-editor-actions">
                <button
                  disabled={!!busyKey}
                  type="button"
                  onClick={() =>
                    void run(participant.id, () =>
                      markEventAttendance(
                        accessToken,
                        organizationId,
                        eventId,
                        participant.id,
                        "ATTENDED",
                      ),
                    )
                  }
                >
                  Mark attended
                </button>
                <button
                  disabled={!!busyKey}
                  className="secondary"
                  type="button"
                  onClick={() =>
                    void run(participant.id, () =>
                      markEventAttendance(
                        accessToken,
                        organizationId,
                        eventId,
                        participant.id,
                        "ABSENT",
                      ),
                    )
                  }
                >
                  Mark absent
                </button>
              </div>
            ) : participant.attendanceStatus === "UNMARKED" ? (
              <small>Attendance opens at the event start time.</small>
            ) : null}
            <button
              className="danger"
              disabled={
                !!busyKey || participant.attendanceStatus === "ATTENDED"
              }
              type="button"
              onClick={() => {
                const reason = window.prompt(
                  "Reason for removing this volunteer (at least 10 characters):",
                );
                if (reason)
                  void run(participant.id, () =>
                    removeEventParticipant(
                      accessToken,
                      organizationId,
                      eventId,
                      participant.id,
                      reason,
                    ),
                  );
              }}
            >
              Remove volunteer
            </button>
          </article>
        ))}</ListWindow>
      )}
    </section>
  );
}
