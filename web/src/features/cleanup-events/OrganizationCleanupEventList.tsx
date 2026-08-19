import { useCallback, useEffect, useState } from "react";
import { describeApiFailure } from "../../api/apiError";
import { listOwnedCleanupEvents } from "./cleanupEvent.api";
import type { CleanupEventOwnedSummary } from "./cleanupEvent.types";

export function OrganizationCleanupEventList({ accessToken, organizationId }: { accessToken: string; organizationId: string }) {
  const [items, setItems] = useState<CleanupEventOwnedSummary[]>([]); const [nextCursor, setNextCursor] = useState<string | null>(null); const [busy, setBusy] = useState(true); const [error, setError] = useState<string>();
  const load = useCallback(async (cursor?: string) => { setBusy(true); setError(undefined); try { const page = await listOwnedCleanupEvents(accessToken, organizationId, cursor); setItems((current) => cursor ? [...current, ...page.items] : page.items); setNextCursor(page.nextCursor); } catch (reason) { setError(describeApiFailure(reason, "Unable to load organization events.").message); } finally { setBusy(false); } }, [accessToken, organizationId]);
  useEffect(() => { const timeout = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timeout); }, [load]);
  return <section className="event-editor"><header className="event-editor-header"><div><span>ORGANIZATION EVENTS</span><h1>Cleanup-event lifecycle</h1><p>Draft and published records belonging only to this organization.</p></div></header>{error && <p className="event-editor-notice error">{error}</p>}<section className="event-editor-panel">{busy && items.length === 0 ? <p>Loading events…</p> : items.length === 0 ? <div className="event-editor-empty"><strong>No cleanup events</strong></div> : <div className="public-event-list">{items.map((item) => <article key={item.id}><strong>{item.title}</strong><span>{item.lifecycleStatus.replaceAll("_", " ")}</span><small>{item.incidentId ? "Incident-linked" : "Direct event"} · Updated {new Date(item.updatedAt).toLocaleString()}</small></article>)}</div>}{nextCursor && <button className="secondary" disabled={busy} onClick={() => void load(nextCursor)}>Load more</button>}</section></section>;
}
