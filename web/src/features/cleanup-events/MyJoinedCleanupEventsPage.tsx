import { useCallback, useEffect, useState } from "react";
import { describeApiFailure } from "../../api/apiError";
import { listMyEventParticipations } from "./cleanupEvent.api";
import type { EventParticipation } from "./cleanupEvent.types";
import "./cleanupEvent.css";

type Props = { accessToken: string; onBack: () => void; onOpenEvent: (eventId: string) => void };

export function MyJoinedCleanupEventsPage({ accessToken, onBack, onOpenEvent }: Props) {
  const [scope, setScope] = useState<"active" | "history">("active");
  const [items, setItems] = useState<EventParticipation[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string>();
  const load = useCallback(async (cursor?: string) => {
    setBusy(true); setError(undefined);
    try { const page = await listMyEventParticipations(accessToken, scope, cursor); setItems((current) => cursor ? [...current, ...page.items] : page.items); setNextCursor(page.nextCursor); }
    catch (reason) { setError(describeApiFailure(reason, "Unable to load your cleanup events.").message); }
    finally { setBusy(false); }
  }, [accessToken, scope]);
  useEffect(() => { const timeout = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timeout); }, [load]);
  return <main className="public-events-shell">
    <header className="event-editor-header"><div><span>MY VOLUNTEERING</span><h1>My joined cleanup events</h1><p>Review commitments, assignments, attendance, and history.</p></div><button className="secondary" type="button" onClick={onBack}>Citizen dashboard</button></header>
    <div className="participation-tabs"><button className={scope === "active" ? "selected" : "secondary"} onClick={() => setScope("active")}>Active</button><button className={scope === "history" ? "selected" : "secondary"} onClick={() => setScope("history")}>History</button></div>
    {error && <p className="event-editor-notice error">{error}</p>}
    <section className="event-editor-panel public-event-list">{busy && items.length === 0 ? <p>Loading your events…</p> : items.length === 0 ? <div className="event-editor-empty"><strong>No {scope} participations</strong><p>{scope === "active" ? "Join a published cleanup to see it here." : "Withdrawn or removed events will appear here."}</p></div> : items.map((item) => <button type="button" key={item.id} onClick={() => onOpenEvent(item.event.id)}><strong>{item.event.title}</strong><span>{item.event.organization.name}</span><small>{item.status} · {item.availableSessionIds.length} available session{item.availableSessionIds.length === 1 ? "" : "s"}</small>{item.allocations.filter(({ status }) => status !== "REMOVED").map((allocation) => { const session = item.event.sessions.find(({ id }) => id === allocation.sessionId); return <small key={allocation.id}>Assigned {session?.sessionDate} {session?.startTime.slice(0, 5)} · {allocation.status}</small>; })}</button>)}{nextCursor && <button type="button" className="secondary" disabled={busy} onClick={() => void load(nextCursor)}>Load more</button>}</section>
  </main>;
}
