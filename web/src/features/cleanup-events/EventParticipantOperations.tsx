import { useCallback, useEffect, useState } from "react";
import { describeApiFailure } from "../../api/apiError";
import { allocateEventParticipant, listEventParticipants, markEventAttendance, reallocateEventParticipant, removeEventAllocation, removeEventParticipant } from "./cleanupEvent.api";
import type { EventParticipantOperationsPage } from "./cleanupEvent.types";

type Props = { accessToken: string; organizationId: string; eventId: string };

export function EventParticipantOperations({ accessToken, organizationId, eventId }: Props) {
  const [page, setPage] = useState<EventParticipantOperationsPage>();
  const [busyKey, setBusyKey] = useState<string>();
  const [error, setError] = useState<string>();
  const load = useCallback(async () => {
    setError(undefined);
    try { setPage(await listEventParticipants(accessToken, organizationId, eventId)); }
    catch (reason) { setError(describeApiFailure(reason, "Unable to load event volunteers.").message); }
  }, [accessToken, eventId, organizationId]);
  useEffect(() => { const timeout = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timeout); }, [load]);
  const run = async (key: string, operation: () => Promise<unknown>) => {
    setBusyKey(key); setError(undefined);
    try { await operation(); await load(); }
    catch (reason) { setError(describeApiFailure(reason, "The participant operation could not be completed.").message); }
    finally { setBusyKey(undefined); }
  };

  return <section className="event-participant-operations">
    <header><div><span>VOLUNTEER OPERATIONS</span><h3>Allocation and attendance</h3></div><button type="button" className="secondary" onClick={() => void load()}>Refresh</button></header>
    {error && <p className="event-editor-notice error" role="alert">{error}</p>}
    {!page ? <p>Loading volunteers…</p> : page.participants.length === 0 ? <div className="event-editor-empty"><strong>No joined volunteers</strong><p>Volunteers appear after joining this published event.</p></div> : page.participants.map((participant) => {
      const active = participant.allocations.filter(({ status }) => status !== "REMOVED");
      const available = page.sessions.filter(({ id }) => participant.availableSessionIds.includes(id));
      const unallocated = available.filter((session) => !active.some(({ sessionId }) => sessionId === session.id));
      return <article className="event-participant-card" key={participant.id}>
        <div className="event-participant-person"><div><strong>{participant.volunteer.fullName ?? "EcoTrack volunteer"}</strong><small>{participant.volunteer.phoneNumber ?? "No phone number provided"}</small></div><span>{participant.status}</span></div>
        <p><strong>Available:</strong> {available.map(({ sessionDate, startTime }) => `${sessionDate} ${startTime.slice(0, 5)}`).join(", ") || "No sessions selected"}</p>
        {active.map((allocation) => {
          const session = page.sessions.find(({ id }) => id === allocation.sessionId);
          return <div className="event-allocation-row" key={allocation.id}><div><strong>{session?.sessionDate} · {session?.startTime.slice(0, 5)}</strong><small>{allocation.status}</small></div>{allocation.status === "PLANNED" && <><select aria-label="Reallocate session" value={allocation.sessionId} onChange={(change) => void run(allocation.id, () => reallocateEventParticipant(accessToken, organizationId, eventId, allocation.id, change.target.value))}>{available.map((item) => <option value={item.id} key={item.id}>{item.sessionDate} · {item.startTime.slice(0, 5)} ({item.allocatedCount}/{item.capacity ?? "open"})</option>)}</select><button disabled={!!busyKey} type="button" onClick={() => void run(allocation.id, () => markEventAttendance(accessToken, organizationId, eventId, allocation.id, "ATTENDED"))}>Attended</button><button disabled={!!busyKey} className="secondary" type="button" onClick={() => void run(allocation.id, () => markEventAttendance(accessToken, organizationId, eventId, allocation.id, "ABSENT"))}>Absent</button><button disabled={!!busyKey} className="danger" type="button" onClick={() => window.confirm("Remove this session allocation?") && void run(allocation.id, () => removeEventAllocation(accessToken, organizationId, eventId, allocation.id))}>Remove allocation</button></>}</div>;
        })}
        <div className="event-editor-actions">{unallocated.map((session) => <button className="secondary" type="button" key={session.id} disabled={!!busyKey || (session.capacity !== null && session.allocatedCount >= session.capacity)} onClick={() => void run(`${participant.id}-${session.id}`, () => allocateEventParticipant(accessToken, organizationId, eventId, participant.id, session.id))}>Allocate {session.sessionDate} {session.startTime.slice(0, 5)}</button>)}</div>
        <button className="danger" disabled={!!busyKey} type="button" onClick={() => { const reason = window.prompt("Reason for removing this volunteer (at least 10 characters):"); if (reason) void run(participant.id, () => removeEventParticipant(accessToken, organizationId, eventId, participant.id, reason)); }}>Remove volunteer from event</button>
      </article>;
    })}
  </section>;
}
