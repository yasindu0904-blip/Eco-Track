import { useCallback, useEffect, useState } from "react";
import { describeApiFailure } from "../../api/apiError";
import { getOwnedCleanupEvent, listOwnedCleanupEvents } from "./cleanupEvent.api";
import type { CleanupEventOwnedSummary } from "./cleanupEvent.types";

type Props = { accessToken: string; organizationId: string; initialEventId?: string };

export function OrganizationCleanupEventList({ accessToken, organizationId, initialEventId }: Props) {
  const [items, setItems] = useState<CleanupEventOwnedSummary[]>([]);
  const [selectedId, setSelectedId] = useState(initialEventId);
  const [selectedRecord, setSelectedRecord] = useState<CleanupEventOwnedSummary>();
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string>();
  const [selectionError, setSelectionError] = useState<string>();
  const load = useCallback(async (cursor?: string) => {
    setBusy(true); setError(undefined);
    try {
      const page = await listOwnedCleanupEvents(accessToken, organizationId, cursor);
      setItems((current) => cursor ? [...current, ...page.items] : page.items);
      setNextCursor(page.nextCursor);
      if (!cursor) setSelectedId((current) => current ?? page.items[0]?.id);
    } catch (reason) {
      setError(describeApiFailure(reason, "Unable to load organization events.").message);
    } finally { setBusy(false); }
  }, [accessToken, organizationId]);
  useEffect(() => { const timeout = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timeout); }, [load]);
  useEffect(() => {
    if (!initialEventId) return;
    let active = true;
    void getOwnedCleanupEvent(accessToken, organizationId, initialEventId)
      .then((record) => {
        if (active) setSelectedRecord(record);
      })
      .catch((reason: unknown) => {
        if (active) setSelectionError(describeApiFailure(reason, "Unable to open the selected organization event.").message);
      });
    return () => { active = false; };
  }, [accessToken, initialEventId, organizationId]);
  const visibleItems = selectedRecord && !items.some((item) => item.id === selectedRecord.id)
    ? [selectedRecord, ...items]
    : items;
  const selected = visibleItems.find((item) => item.id === selectedId);

  return <section className="event-editor">
    <header className="event-editor-header"><div><span>ORGANIZATION EVENTS</span><h1>Cleanup-event lifecycle</h1><p>Draft and published records belonging only to this organization.</p></div></header>
    {error && <p className="event-editor-notice error" role="alert">{error}</p>}
    {selectionError && <p className="event-editor-notice error" role="alert">{selectionError}</p>}
    <section className="event-editor-panel">
      {busy && visibleItems.length === 0 ? <p>Loading events…</p> : visibleItems.length === 0 ? <div className="event-editor-empty"><strong>No cleanup events</strong></div> : <div className="public-event-list">
        {visibleItems.map((item) => <button type="button" className={item.id === selectedId ? "selected" : undefined} key={item.id} onClick={() => { setSelectedId(item.id); setSelectedRecord(item); setSelectionError(undefined); }}>
          <strong>{item.title}</strong><span>{item.lifecycleStatus.replaceAll("_", " ")}</span><small>{item.incidentId ? "Incident-linked" : "Direct event"} · Updated {new Date(item.updatedAt).toLocaleString()}</small>
        </button>)}
      </div>}
      {nextCursor && <button className="secondary" disabled={busy} onClick={() => void load(nextCursor)}>Load more</button>}
    </section>
    {selected && <section className="event-editor-panel public-event-detail" aria-label="Selected organization event">
      <span className="public-event-status">{selected.lifecycleStatus.replaceAll("_", " ")}</span>
      <h2>{selected.title}</h2><p>{selected.description}</p>
      <p><strong>{selected.incidentId ? `Linked incident ${selected.incidentId}` : "Direct cleanup event"}</strong></p>
      <p>{selected.eventAddress ?? `${selected.eventLatitude}, ${selected.eventLongitude}`}</p>
    </section>}
  </section>;
}
