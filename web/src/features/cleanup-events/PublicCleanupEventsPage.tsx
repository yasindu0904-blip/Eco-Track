import { useCallback, useEffect, useState } from "react";

import { describeApiFailure } from "../../api/apiError";
import { getPublicCleanupEvent, listPublicCleanupEvents } from "./cleanupEvent.api";
import type { CleanupEventPublicDetail, CleanupEventPublicSummary } from "./cleanupEvent.types";
import { EventParticipationPanel } from "./EventParticipationPanel";
import { ParticipantEventUpdates } from "./ParticipantEventUpdates";
import "./cleanupEvent.css";

type Props = { accessToken: string; initialEventId?: string; onBack: () => void };
const formatDate = (value: string | null) => value ? new Date(value).toLocaleString() : "Schedule to be confirmed";

export function PublicCleanupEventsPage({ accessToken, initialEventId, onBack }: Props) {
  const [items, setItems] = useState<CleanupEventPublicSummary[]>([]);
  const [selected, setSelected] = useState<CleanupEventPublicDetail>();
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string>();
  const load = useCallback(async (cursor?: string) => {
    setBusy(true); setError(undefined);
    try {
      const page = await listPublicCleanupEvents(accessToken, cursor);
      setItems((current) => cursor ? [...current, ...page.items] : page.items);
      setNextCursor(page.nextCursor);
      if (!cursor && !initialEventId && page.items[0]) setSelected(await getPublicCleanupEvent(accessToken, page.items[0].id));
    } catch (reason) { setError(describeApiFailure(reason, "Unable to load cleanup events.").message); }
    finally { setBusy(false); }
  }, [accessToken, initialEventId]);
  const open = useCallback(async (id: string) => { setBusy(true); setError(undefined); try { setSelected(await getPublicCleanupEvent(accessToken, id)); } catch (reason) { setError(describeApiFailure(reason, "Unable to open this event.").message); } finally { setBusy(false); } }, [accessToken]);
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (initialEventId) void open(initialEventId);
      else void load();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [initialEventId, load, open]);

  return <main className="public-events-shell">
    <header className="event-editor-header"><div><span>COMMUNITY CLEANUPS</span><h1>Published cleanup events</h1><p>Choose a public event to see its verified schedule, instructions, and join options.</p></div><button className="event-action-button secondary" type="button" onClick={onBack}>Back</button></header>
    {error && <p className="event-editor-notice error" role="alert">{error}</p>}
    <div className="public-events-layout"><section className="event-editor-panel"><h2>Upcoming and active events</h2>{busy && items.length === 0 ? <p>Loading events…</p> : items.length === 0 ? <div className="event-editor-empty"><strong>No published events yet</strong><p>Organization drafts appear here only after publishing.</p></div> : <div className="public-event-list">{items.map((item) => <button type="button" className={selected?.id === item.id ? "selected" : ""} key={item.id} onClick={() => void open(item.id)}><strong>{item.title}</strong><span>{item.organization.name}</span><small>{formatDate(item.firstSessionAt)} · {item.lifecycleStatus.replaceAll("_", " ")}</small></button>)}</div>}{nextCursor && <button className="event-action-button secondary" disabled={busy} type="button" onClick={() => void load(nextCursor)}>Load more</button>}</section>
      <section className="event-editor-panel public-event-detail">{!selected ? <><h2>Select an event</h2><p>Public details do not expose private coordinator or planning notes.</p></> : <><span className="public-event-status">{selected.lifecycleStatus.replaceAll("_", " ")}</span><h2>{selected.title}</h2><p><strong>{selected.organization.name}</strong></p><p>{selected.description}</p><h3>Volunteer instructions</h3><p>{selected.publicInstructions}</p><h3>Location</h3><p>{selected.meetingAddress || selected.eventAddress || `${selected.eventLatitude}, ${selected.eventLongitude}`}</p><h3>Sessions</h3>{selected.sessions.map((session) => <article className="public-event-session" key={session.id}><strong>{session.sessionDate}</strong><span>{session.startTime.slice(0, 5)}–{session.endTime.slice(0, 5)}</span><small>{session.locationAddress || "Event location"} · {session.capacity ?? "Open"} capacity</small></article>)}<EventParticipationPanel accessToken={accessToken} event={selected} /><ParticipantEventUpdates accessToken={accessToken} eventId={selected.id} /></>}</section>
    </div>
  </main>;
}
