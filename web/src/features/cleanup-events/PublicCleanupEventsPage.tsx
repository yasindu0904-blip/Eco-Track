import { IncidentEvidence } from "../incidents/IncidentEvidence";
import { getPublicIncident } from "../incidents/incident.api";
import type { IncidentDetail } from "../incidents/incident.types";
import { useListScroll } from "../../components/lists/useListScroll";
import { ListSections, PageControls } from "../../components/lists/ListControls";
import { eventSections, useListState, usePagedList, type EventSection } from "../../components/lists/usePagedList";
import { useCallback, useEffect, useRef, useState } from "react";

import { describeApiFailure } from "../../api/apiError";
import {
  getPublicCleanupEvent,
  listPublicCleanupEvents,
} from "./cleanupEvent.api";
import type {
  CleanupEventPublicDetail,
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

export function PublicCleanupEventsPage({ accessToken, initialEventId }: Props) {
  const detailOnly = Boolean(initialEventId);
  const [section, setSection] = useListState<EventSection>("events.section", "upcoming");
  const list = usePagedList("events:" + section, cursor => listPublicCleanupEvents(accessToken, cursor, section), false, !initialEventId);
  useListScroll("events:" + section + ":" + list.pageNumber, !list.busy && !initialEventId);
  const items = list.items;
  const detailRequest = useRef(0);
  useEffect(() => () => { detailRequest.current += 1; }, []);
  const [incident, setIncident] = useState<IncidentDetail>();
  const [selected, setSelected] = useState<CleanupEventPublicDetail>();
  const [busy, setBusy] = useState(Boolean(initialEventId));
  const [error, setError] = useState<string>();
  const [participationContext, setParticipationContext] = useState<{
    eventId: string;
    participation: EventParticipation | null;
  }>();
  const open = useCallback(
    async (id: string) => {
      const request = ++detailRequest.current;
      setBusy(true);
      setError(undefined);
      setIncident(undefined);
      try {
        const detail = await getPublicCleanupEvent(accessToken, id);
        if (request !== detailRequest.current) return;
        setSelected(detail);
        if (detail.incidentId) {
          const linkedIncident = await getPublicIncident(accessToken, detail.incidentId);
          if (request === detailRequest.current) setIncident(linkedIncident);
        }
      } catch (reason) {
        if (request !== detailRequest.current) return;
        setError(
          describeApiFailure(reason, "Unable to open this event.").message,
        );
      } finally {
        if (request === detailRequest.current) setBusy(false);
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
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [initialEventId, open]);

  return (
    <main className="public-events-shell">
      <header className="event-editor-header">
        <div>
          <span>COMMUNITY CLEANUPS</span>
          <h1>{selected?.title ?? "Published cleanup events"}</h1>

        </div>

      </header>
      {!initialEventId && <ListSections value={section} options={eventSections} onChange={value => { detailRequest.current += 1; setBusy(false); setSection(value); setSelected(undefined); }} />}
      {list.error && <p role="alert">{list.error}</p>}
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
            {list.busy && items.length === 0 ? (
              <p>Loading events…</p>
            ) : items.length === 0 ? (
              <div className="event-editor-empty">
                <strong>No published events yet</strong>

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
            <PageControls {...list} />
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
              {incident && <IncidentEvidence incident={incident} />}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
