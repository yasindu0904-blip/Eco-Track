import { useCallback, useEffect, useState } from "react";

import { describeApiFailure } from "../../api/apiError";
import { getMyEventParticipation, joinCleanupEvent, updateEventAvailability, withdrawFromCleanupEvent } from "./cleanupEvent.api";
import type { CleanupEventPublicDetail, EventParticipation } from "./cleanupEvent.types";

type Props = { accessToken: string; event: CleanupEventPublicDetail; onChanged?: (value: EventParticipation | null) => void };

export function EventParticipationPanel({ accessToken, event, onChanged }: Props) {
  const [participation, setParticipation] = useState<EventParticipation | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  const loadParticipation = useCallback(async (showLoading = true): Promise<void> => {
    if (showLoading) setBusy(true);
    setError(undefined);
    try {
      const value = await getMyEventParticipation(accessToken, event.id);
      setParticipation(value);
      setSelected(value?.availableSessionIds ?? []);
      onChanged?.(value);
    } catch (reason) {
      setError(describeApiFailure(reason, "Unable to load your participation.").message);
    } finally {
      if (showLoading) setBusy(false);
    }
  }, [accessToken, event.id, onChanged]);

  useEffect(() => {
    let active = true;
    const timeout = window.setTimeout(() => {
      if (active) void loadParticipation();
    }, 0);
    const refreshWhenVisible = () => {
      if (active && document.visibilityState === "visible") void loadParticipation(false);
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      active = false;
      window.clearTimeout(timeout);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [loadParticipation]);

  function toggle(sessionId: string): void {
    setSelected((current) => current.includes(sessionId) ? current.filter((id) => id !== sessionId) : [...current, sessionId]);
  }

  async function save(): Promise<void> {
    if (selected.length === 0) { setError("Select at least one future session."); return; }
    setBusy(true); setError(undefined); setMessage(undefined);
    try {
      const saved = participation?.status === "JOINED"
        ? await updateEventAvailability(accessToken, event.id, selected)
        : (await joinCleanupEvent(accessToken, event.id, selected)).participation;
      setParticipation(saved);
      setSelected(saved.availableSessionIds);
      setMessage(participation?.status === "JOINED" ? "Your availability was updated." : "You joined this cleanup event.");
      onChanged?.(saved);
    } catch (reason) { setError(describeApiFailure(reason, "Unable to save your participation.").message); }
    finally { setBusy(false); }
  }

  async function withdraw(): Promise<void> {
    if (!window.confirm("Withdraw from this cleanup event? Your saved availability will remain in the event history.")) return;
    setBusy(true); setError(undefined); setMessage(undefined);
    try {
      const saved = await withdrawFromCleanupEvent(accessToken, event.id);
      setParticipation(saved);
      setMessage("You have withdrawn from this event.");
      onChanged?.(saved);
    } catch (reason) { setError(describeApiFailure(reason, "Unable to withdraw from this event.").message); }
    finally { setBusy(false); }
  }

  const canJoin = ["PUBLISHED", "SCHEDULED"].includes(event.lifecycleStatus);
  const isActive = participation?.status === "JOINED";
  const isRemoved = participation?.status === "REMOVED";
  const activeAllocations = participation?.allocations.filter(({ status }) => status !== "REMOVED") ?? [];

  return <section className="event-participation" aria-labelledby="participation-title">
    <div className="event-participation-heading">
      <div><span className="event-participation-eyebrow">VOLUNTEER AVAILABILITY</span><h3 id="participation-title">{isActive ? "Your selected sessions" : "Join this cleanup"}</h3><p>Select every session you can attend. Availability is a preference and does not guarantee allocation.</p></div>
      {participation && <button type="button" className="event-action-button secondary" disabled={busy} onClick={() => void loadParticipation()}>{busy ? "Refreshing…" : "Refresh assignment"}</button>}
    </div>
    {participation && <span className={`participation-status ${participation.status.toLowerCase()}`}>{participation.status}</span>}
    {error && <p className="event-editor-notice error" role="alert">{error}</p>}
    {message && <p className="event-editor-notice" role="status">{message}</p>}
    {isActive && <section className="participation-assignments" aria-labelledby="assignment-title">
      <div><span className="event-participation-eyebrow">EVENT TEAM ASSIGNMENT</span><h4 id="assignment-title">Your assigned sessions</h4></div>
      {activeAllocations.length === 0
        ? <p className="event-editor-notice">You are joined, but the event team has not assigned you to a session yet.</p>
        : activeAllocations.map((allocation) => {
          const session = event.sessions.find(({ id }) => id === allocation.sessionId);
          return <article className="participation-assignment" key={allocation.id}>
            <div><strong>{session ? `${session.sessionDate} · ${session.startTime.slice(0, 5)}–${session.endTime.slice(0, 5)}` : "Assigned event session"}</strong><small>{session?.locationAddress || event.meetingAddress || event.eventAddress || "Event location"}</small></div>
            <span className={`participation-status ${allocation.status.toLowerCase()}`}>{allocation.status === "PLANNED" ? "ASSIGNED" : allocation.status}</span>
          </article>;
        })}
    </section>}
    <div className="participation-session-options">{event.sessions.map((session) => <label key={session.id}><input type="checkbox" checked={selected.includes(session.id)} disabled={busy || isRemoved || (!isActive && !canJoin)} onChange={() => toggle(session.id)} /><span><strong>{session.sessionDate} · {session.startTime.slice(0, 5)}–{session.endTime.slice(0, 5)}</strong><small>{session.locationAddress || "Event location"}</small></span></label>)}</div>
    {isRemoved ? <p className="event-editor-notice error">This participation was removed by the event team and cannot be rejoined.</p> : canJoin || isActive ? <div className="event-editor-actions"><button type="button" disabled={busy || selected.length === 0} onClick={() => void save()}>{isActive ? "Update availability" : participation?.status === "WITHDRAWN" ? "Rejoin cleanup" : "Join cleanup"}</button>{isActive && <button type="button" className="danger" disabled={busy} onClick={() => void withdraw()}>Withdraw</button>}</div> : <p className="event-editor-notice">This event is no longer open for joining.</p>}
  </section>;
}
