import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { describeApiFailure } from "../../api/apiError";
import { ListSections } from "../../components/lists/ListControls";
import type { EventSection } from "../../components/lists/usePagedList";
import { getPublicCleanupEvent, listPublicCleanupEventMap } from "../cleanup-events/cleanupEvent.api";
import type { CleanupEventPublicDetail } from "../cleanup-events/cleanupEvent.types";
import { getPublicIncident, listPublicIncidents } from "../incidents/incident.api";
import { IncidentEvidence } from "../incidents/IncidentEvidence";
import type { IncidentDetail, PublicIncidentSummary } from "../incidents/incident.types";
import { AdministrativeAreaMapSearch, EcoMap, type MapBoundaryFeatureCollection, type MapMarkerFeature, type MapViewport } from "../maps";

type Section = "all" | "awaiting" | EventSection;
const sections: { value: Section; label: string }[] = [
  { value: "all", label: "Active activity" }, { value: "awaiting", label: "Awaiting cleanup" },
  { value: "upcoming", label: "Upcoming" }, { value: "ongoing", label: "Ongoing" },
  { value: "past", label: "Completed" }, { value: "cancelled", label: "Cancelled" },
];
const readable = (value: string) => value.toLowerCase().replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());

export function SuperAdminMapOverview({ accessToken }: { accessToken: string }) {
  const [section, setSection] = useState<Section>("all");
  const [incidents, setIncidents] = useState<PublicIncidentSummary[]>([]);
  const [events, setEvents] = useState<MapMarkerFeature[]>([]);
  const [incidentCursor, setIncidentCursor] = useState<string | null>(null);
  const [eventCursor, setEventCursor] = useState<string | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<MapMarkerFeature>();
  const [searchedBoundary, setSearchedBoundary] = useState<MapBoundaryFeatureCollection>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [incidentDetail, setIncidentDetail] = useState<IncidentDetail>();
  const [eventDetail, setEventDetail] = useState<CleanupEventPublicDetail>();
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string>();
  const [detailAttempt, setDetailAttempt] = useState(0);
  const viewport = useRef<MapViewport | undefined>(undefined);
  const requestController = useRef<AbortController | undefined>(undefined);
  const detailRegion = useRef<HTMLDivElement>(null);
  const area = searchedBoundary?.features[0]?.properties;
  const administrativeAreaId = area?.id;
  const sectionLabel = sections.find((item) => item.value === section)!.label;

  const markers = useMemo<MapMarkerFeature[]>(() => [
    ...incidents.map((incident) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [incident.longitude, incident.latitude] as [number, number] },
      properties: { id: incident.id, kind: "INCIDENT" as const, title: incident.title,
        status: readable(incident.status), category: incident.category.name, occurredAt: incident.reportedAt },
    })),
    ...events.map((event) => ({ ...event, properties: { ...event.properties, status: readable(event.properties.status) } })),
  ], [incidents, events]);

  const load = useCallback(async (
    nextViewport: MapViewport, context: { signal: AbortSignal },
    cursors?: { incident: string | null; event: string | null },
  ) => {
    requestController.current?.abort();
    if (context.signal.aborted) return;
    const controller = new AbortController();
    requestController.current = controller;
    const abort = () => controller.abort();
    context.signal.addEventListener("abort", abort, { once: true });
    viewport.current = nextViewport;
    setLoading(true); setError(undefined);
    if (!cursors) {
      setIncidents([]); setEvents([]); setIncidentCursor(null); setEventCursor(null); setSelectedMarker(undefined);
    }
    try {
      const query = { ...nextViewport, administrativeAreaId, limit: 100 };
      const [incidentPage, eventPage] = await Promise.all([
        (section === "all" || section === "awaiting") && (!cursors || cursors.incident)
          ? listPublicIncidents(accessToken, { ...query, awaitingCleanup: section === "awaiting" ? true : undefined,
              cursor: cursors?.incident ?? undefined }, controller.signal) : Promise.resolve(undefined),
        section !== "awaiting" && (!cursors || cursors.event)
          ? listPublicCleanupEventMap(accessToken, { ...query, section: section === "all" ? undefined : section,
              cursor: cursors?.event ?? undefined }, controller.signal) : Promise.resolve(undefined),
      ]);
      if (controller.signal.aborted) return;
      if (incidentPage) {
        setIncidents((current) => cursors ? [...new Map([...current, ...incidentPage.items].map((item) => [item.id, item])).values()] : incidentPage.items);
        setIncidentCursor(incidentPage.nextCursor);
      }
      if (eventPage) {
        setEvents((current) => cursors ? [...new Map([...current, ...eventPage.features].map((item) => [item.properties.id, item])).values()] : eventPage.features);
        setEventCursor(eventPage.nextCursor);
      }
    } catch (reason) {
      if (!controller.signal.aborted) setError(describeApiFailure(reason, "Unable to load map activity.").message);
    } finally {
      context.signal.removeEventListener("abort", abort);
      if (requestController.current === controller && !controller.signal.aborted) setLoading(false);
    }
  }, [accessToken, section, administrativeAreaId]);

  // Refresh category/GN filters even when the map has not moved.
  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted && viewport.current) void load(viewport.current, { signal: controller.signal });
    });
    return () => { controller.abort(); requestController.current?.abort(); };
  }, [load]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(async () => {
      if (controller.signal.aborted) return;
      setIncidentDetail(undefined); setEventDetail(undefined); setDetailError(undefined);
      setDetailLoading(Boolean(selectedMarker));
      if (!selectedMarker) return;
      try {
        if (selectedMarker.properties.kind === "INCIDENT") {
          const incident = await getPublicIncident(accessToken, selectedMarker.properties.id, controller.signal);
          if (!controller.signal.aborted) setIncidentDetail(incident);
        } else {
          const event = await getPublicCleanupEvent(accessToken, selectedMarker.properties.id, controller.signal);
          if (controller.signal.aborted) return;
          setEventDetail(event);
          if (event.incidentId) {
            const incident = await getPublicIncident(accessToken, event.incidentId, controller.signal);
            if (!controller.signal.aborted) setIncidentDetail(incident);
          }
        }
      } catch (reason) {
        if (!controller.signal.aborted) setDetailError(describeApiFailure(reason, "Unable to load activity details.").message);
      } finally { if (!controller.signal.aborted) setDetailLoading(false); }
    });
    return () => controller.abort();
  }, [accessToken, selectedMarker, detailAttempt]);

  function selectMarker(marker: MapMarkerFeature) {
    setSelectedMarker(marker);
    detailRegion.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
  }
  function changeSection(value: Section) {
    if (value === section) return;
    requestController.current?.abort();
    setSection(value); setIncidents([]); setEvents([]);
    setIncidentCursor(null); setEventCursor(null); setSelectedMarker(undefined);
  }
  function changeBoundary(boundary: MapBoundaryFeatureCollection | undefined) {
    if (boundary?.features[0]?.properties.id === administrativeAreaId) return;
    requestController.current?.abort();
    setSearchedBoundary(boundary); setIncidents([]); setEvents([]);
    setIncidentCursor(null); setEventCursor(null); setSelectedMarker(undefined);
  }
  const refresh = () => viewport.current && void load(viewport.current, { signal: new AbortController().signal });

  return <section className="super-admin-map-card" aria-label="Public map oversight">
    <h2>Incidents and cleanup events</h2>
    <ListSections value={section} options={sections} onChange={changeSection} />
    <AdministrativeAreaMapSearch accessToken={accessToken} onBoundaryChange={changeBoundary} />
    {area && <p>Showing {sectionLabel.toLowerCase()} in <strong>{area.name}</strong>.</p>}
    {error && <p role="alert">{error} <button type="button" onClick={refresh}>Retry</button></p>}
    <EcoMap markers={markers} boundaries={searchedBoundary} selectedMarkerId={selectedMarker?.properties.id}
      height={460} showMarkerCoordinates={false} listTitle={area ? `Activity in ${area.name}` : sectionLabel}
      accessibleLabel="Super Admin public incident and cleanup event map"
      onMarkerSelect={selectMarker} markerActionLabel={() => "View details"} onMarkerAction={selectMarker} onViewportChange={load} />
    <p role="status" aria-live="polite">{loading ? "Loading map…" : error ? "Map activity could not be loaded." : markers.length === 0
      ? `No ${section === "awaiting" ? "incidents awaiting cleanup" : section === "all" ? "active activity" : `${sectionLabel.toLowerCase()} cleanup events`} found ${area ? `in ${area.name}` : "in this view"}.`
      : `${incidents.length} incidents · ${events.length} cleanup events`}</p>
    {(incidentCursor || eventCursor) && <button type="button" disabled={loading} onClick={() => {
      if (viewport.current) void load(viewport.current, { signal: new AbortController().signal }, { incident: incidentCursor, event: eventCursor });
    }}>{loading ? "Loading…" : "Load more public markers"}</button>}
    <div ref={detailRegion} className="super-admin-map-details" aria-live="polite">
      {selectedMarker && <button type="button" className="secondary" onClick={() => setSelectedMarker(undefined)}>Close details</button>}
      {selectedMarker && detailLoading && <p role="status">Loading activity details…</p>}
      {selectedMarker && detailError && <p role="alert">{detailError} <button type="button" onClick={() => setDetailAttempt((value) => value + 1)}>Retry details</button></p>}
      {selectedMarker && eventDetail && <article className="citizen-discovery-detail" aria-label="Cleanup event details">
        <h3>{eventDetail.title}</h3><p>{eventDetail.description}</p>
        <dl>
          <div><dt>Organization</dt><dd>{eventDetail.organization.name}</dd></div>
          <div><dt>Status</dt><dd>{readable(eventDetail.displayStatus)}</dd></div>
          <div><dt>Starts</dt><dd>{new Date(eventDetail.startsAt).toLocaleString()}</dd></div>
          <div><dt>Location</dt><dd>{eventDetail.eventAddress || "See map marker"}</dd></div>
          {eventDetail.meetingAddress && <div><dt>Meeting point</dt><dd>{eventDetail.meetingAddress}</dd></div>}
          <div><dt>Volunteers</dt><dd>{eventDetail.joinedVolunteerCount}{eventDetail.capacity !== null ? ` / ${eventDetail.capacity}` : " (no capacity limit)"}</dd></div>
        </dl>
        {eventDetail.publicInstructions && <p><strong>Volunteer instructions:</strong> {eventDetail.publicInstructions}</p>}
      </article>}
      {selectedMarker && incidentDetail && <>
        <p>{readable(incidentDetail.status)} · Reported {new Date(incidentDetail.reportedAt).toLocaleString()}</p>
        <IncidentEvidence incident={incidentDetail} awaitingCleanup={section === "awaiting"} />
      </>}
    </div>
  </section>;
}
