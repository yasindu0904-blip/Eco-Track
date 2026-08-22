import { useCallback, useMemo, useRef, useState } from "react";
import { describeApiFailure } from "../../api/apiError";
import { listPublicCleanupEventMap } from "../cleanup-events/cleanupEvent.api";
import { listPublicIncidents } from "../incidents/incident.api";
import type { PublicIncidentSummary } from "../incidents/incident.types";
import { EcoMap, type MapMarkerFeature, type MapViewport, type MapViewportChangeHandler } from "../maps";

export function SuperAdminMapOverview({ accessToken }: { accessToken: string }) {
  const [incidents, setIncidents] = useState<PublicIncidentSummary[]>([]);
  const [events, setEvents] = useState<MapMarkerFeature[]>([]);
  const [viewport, setViewport] = useState<MapViewport>();
  const [incidentCursor, setIncidentCursor] = useState<string | null>(null);
  const [eventCursor, setEventCursor] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const loadMoreController = useRef<AbortController | undefined>(undefined);
  const markers = useMemo<MapMarkerFeature[]>(() => [
    ...incidents.map((incident) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [incident.longitude, incident.latitude] as [number, number] },
      properties: { id: incident.id, kind: "INCIDENT" as const, title: incident.title, status: incident.status, category: incident.category.name, occurredAt: incident.reportedAt },
    })),
    ...events,
  ], [events, incidents]);

  const load = useCallback<MapViewportChangeHandler>(async (nextViewport, context) => {
    loadMoreController.current?.abort();
    setViewport(nextViewport); setLoading(true); setError(undefined);
    try {
      const [incidentPage, eventPage] = await Promise.all([
        listPublicIncidents(accessToken, { ...nextViewport, limit: 100 }, context.signal),
        listPublicCleanupEventMap(accessToken, { ...nextViewport, limit: 100 }, context.signal),
      ]);
      if (context.signal.aborted) return;
      setIncidents(incidentPage.items); setEvents(eventPage.features);
      setIncidentCursor(incidentPage.nextCursor); setEventCursor(eventPage.nextCursor);
      setSelectedId((current) => incidentPage.items.some((item) => item.id === current) || eventPage.features.some((item) => item.properties.id === current) ? current : undefined);
    } catch (requestError) {
      if (!context.signal.aborted) setError(describeApiFailure(requestError, "Unable to load public map markers.").message);
    } finally { if (!context.signal.aborted) setLoading(false); }
  }, [accessToken]);

  const loadMore = async () => {
    if (!viewport || (!incidentCursor && !eventCursor)) return;
    loadMoreController.current?.abort();
    const controller = new AbortController(); loadMoreController.current = controller;
    setLoading(true); setError(undefined);
    try {
      const [incidentPage, eventPage] = await Promise.all([
        incidentCursor ? listPublicIncidents(accessToken, { ...viewport, limit: 100, cursor: incidentCursor }, controller.signal) : Promise.resolve(undefined),
        eventCursor ? listPublicCleanupEventMap(accessToken, { ...viewport, limit: 100, cursor: eventCursor }, controller.signal) : Promise.resolve(undefined),
      ]);
      if (controller.signal.aborted) return;
      if (incidentPage) {
        setIncidents((current) => [...new Map([...current, ...incidentPage.items].map((item) => [item.id, item])).values()]);
        setIncidentCursor(incidentPage.nextCursor);
      }
      if (eventPage) {
        setEvents((current) => [...new Map([...current, ...eventPage.features].map((item) => [item.properties.id, item])).values()]);
        setEventCursor(eventPage.nextCursor);
      }
    } catch (requestError) {
      if (!controller.signal.aborted) setError(describeApiFailure(requestError, "Unable to load more public markers.").message);
    } finally { if (!controller.signal.aborted) setLoading(false); }
  };

  return <section className="super-admin-map-card" aria-label="Public map oversight">
    <span className="super-admin-eyebrow">Public map oversight</span><h2>Incidents and cleanup events</h2>
    <p>Read-only, public-safe operational awareness. Assignment and organization actions are intentionally unavailable.</p>
    {error && <p role="alert">{error}</p>}
    <EcoMap markers={markers} selectedMarkerId={selectedId} height={460} accessibleLabel="Super Admin public incident and cleanup event map" onMarkerSelect={(marker) => setSelectedId(marker.properties.id)} onViewportChange={load} />
    <p role="status">{loading ? "Loading map…" : `${incidents.length} incidents · ${events.length} cleanup events`}</p>
    {(incidentCursor || eventCursor) && <button type="button" disabled={loading} onClick={() => void loadMore()}>{loading ? "Loading…" : "Load more public markers"}</button>}
  </section>;
}
