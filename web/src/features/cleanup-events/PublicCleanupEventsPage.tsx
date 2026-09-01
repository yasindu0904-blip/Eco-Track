import { useCallback, useEffect, useState } from "react";

import { describeApiFailure } from "../../api/apiError";
import {
  getPublicCleanupEvent,
  listPublicCleanupEvents,
} from "./cleanupEvent.api";
import type {
  CleanupEventPublicDetail,
  CleanupEventPublicSummary,
  EventParticipation,
} from "./cleanupEvent.types";
import { EventParticipationPanel } from "./EventParticipationPanel";
import { ParticipantEventUpdates } from "./ParticipantEventUpdates";
import "./cleanupEvent.css";

type Props = {
  accessToken: string;
  initialEventId?: string;
  onBack: () => void;
};
const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleString() : "Schedule to be confirmed";

export function PublicCleanupEventsPage({
  accessToken,
  initialEventId,
  onBack,
}: Props) {
  const detailOnly = Boolean(initialEventId);
  const [items, setItems] = useState<CleanupEventPublicSummary[]>([]);
  const [selected, setSelected] = useState<CleanupEventPublicDetail>();
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string>();
  const [participationContext, setParticipationContext] = useState<{
    eventId: string;
    participation: EventParticipation | null;
  }>();
  const load = useCallback(
    async (cursor?: string) => {
      setBusy(true);
      setError(undefined);
      try {
        const page = await listPublicCleanupEvents(accessToken, cursor);
        setItems((current) =>
          cursor ? [...current, ...page.items] : page.items,
        );
        setNextCursor(page.nextCursor);
        if (!cursor && !initialEventId && page.items[0])
          setSelected(
            await getPublicCleanupEvent(accessToken, page.items[0].id),
          );
      } catch (reason) {
        setError(
          describeApiFailure(reason, "Unable to load cleanup events.").message,
        );
      } finally {
        setBusy(false);
      }
    },
    [accessToken, initialEventId],
  );
  const open = useCallback(
    async (id: string) => {
      setBusy(true);
      setError(undefined);
      try {
        setSelected(await getPublicCleanupEvent(accessToken, id));
      } catch (reason) {
        setError(
          describeApiFailure(reason, "Unable to open this event.").message,
        );
      } finally {
        setBusy(false);
      }
    },
    [accessToken],
  );
  const handleParticipationChanged = useCallback(
    (participation: EventParticipation | null) => {
      if (selected)
        setParticipationContext({ eventId: selected.id, participation });
    },
    [selected],
  );
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (initialEventId) void open(initialEventId);
      else void load();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [initialEventId, load, open]);

  return (
    <main className="public-events-shell">
      <header className="event-editor-header">
        <div>
          <span>COMMUNITY CLEANUPS</span>
          <h1>{selected?.title ?? "Published cleanup events"}</h1>
          <p>
            {detailOnly
              ? "Review the schedule, instructions, and volunteer options for this cleanup."
              : "Choose a public event to see its verified schedule, instructions, and join options."}
          </p>
        </div>
        <button
          className="event-action-button secondary"
          type="button"
          onClick={onBack}
        >
          Back
        </button>
      </header>
      {error && (
        <p className="event-editor-notice error" role="alert">
          {error}
        </p>
      )}
      <div
        className={`public-events-layout${detailOnly ? " detail-only" : ""}`}
      >
        {!detailOnly && (
          <section className="event-editor-panel">
            <h2>Upcoming and active events</h2>
            {busy && items.length === 0 ? (
              <p>Loading events…</p>
            ) : items.length === 0 ? (
              <div className="event-editor-empty">
                <strong>No published events yet</strong>
                <p>Organization drafts appear here only after publishing.</p>
              </div>
            ) : (
              <div className="public-event-list">
                {items.map((item) => (
                  <button
                    type="button"
                    className={selected?.id === item.id ? "selected" : ""}
                    key={item.id}
                    onClick={() => void open(item.id)}
                  >
                    <strong>{item.title}</strong>
                    <span>{item.organization.name}</span>
                    <small>
                      {formatDate(item.startsAt)} · {item.displayStatus}
                    </small>
                  </button>
                ))}
              </div>
            )}
            {nextCursor && (
              <button
                className="event-action-button secondary"
                disabled={busy}
                type="button"
                onClick={() => void load(nextCursor)}
              >
                Load more
              </button>
            )}
          </section>
        )}
        <section className="event-editor-panel public-event-detail">
          {!selected ? (
            busy ? (
              <>
                <h2>Loading event...</h2>
                <p>Retrieving the published event and volunteer options.</p>
              </>
            ) : (
              <>
                <h2>Select an event</h2>
                <p>
                  Public details do not expose private coordinator or planning
                  notes.
                </p>
              </>
            )
          ) : (
            <>
              <span className="public-event-status">
                {selected.displayStatus}
              </span>
              <h2>{selected.title}</h2>
              <p>
                <strong>{selected.organization.name}</strong>
              </p>
              <p>{selected.description}</p>
              <h3>Date and time</h3>
              <p>{formatDate(selected.startsAt)}</p>
              <h3>Volunteer instructions</h3>
              <p>{selected.publicInstructions}</p>
              <h3>Location</h3>
              <p>
                {selected.meetingAddress ||
                  selected.eventAddress ||
                  `${selected.eventLatitude}, ${selected.eventLongitude}`}
              </p>
              <p>
                {selected.joinedVolunteerCount} volunteer
                {selected.joinedVolunteerCount === 1 ? "" : "s"} joined ·{" "}
                {selected.capacity ?? "Open"} capacity
              </p>
              <EventParticipationPanel
                accessToken={accessToken}
                event={selected}
                onChanged={handleParticipationChanged}
              />
              {participationContext?.eventId === selected.id &&
                participationContext.participation?.status === "JOINED" && (
                  <ParticipantEventUpdates
                    accessToken={accessToken}
                    eventId={selected.id}
                  />
                )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
