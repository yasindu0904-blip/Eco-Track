import { IncidentEvidence } from "./IncidentEvidence";
import { useListScroll } from "../../components/lists/useListScroll";
import { ListSections, PageControls } from "../../components/lists/ListControls";
import { eventSections, useListState, type EventSection } from "../../components/lists/usePagedList";
import { useCallback, useEffect, useRef, useState } from "react";

import { describeApiFailure } from "../../api/apiError";
import {
  getPublicCleanupEvent,
  listNearbyCleanupEventMap,
} from "../cleanup-events/cleanupEvent.api";
import type {
  CleanupEventPublicDetail,
} from "../cleanup-events/cleanupEvent.types";
import {
  AdministrativeAreaMapSearch,
  EcoMap,
  SRI_LANKA_MAP_BOUNDS,
  type MapBoundaryFeatureCollection,
  type MapLocation,
  type MapMarkerFeature,
} from "../maps";
import "./citizenIncidentDiscovery.css";

type Props = {
  accessToken: string;
  onOpenEvent?: (eventId: string) => void;
};

import { getPublicIncident, listNearbyPublicIncidents } from "./incident.api";
import type { IncidentDetail } from "./incident.types";

type DiscoverySection = EventSection | "awaiting";
const discoverySections = [...eventSections, { value: "awaiting" as const, label: "Awaiting cleanup" }];

type SearchContext = { location: MapLocation; radiusMeters: number };

const RADIUS_OPTIONS = [1_000, 2_000, 3_000] as const;

function readable(value: string): string {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function locationInsideSriLanka(location: MapLocation): boolean {
  return (
    location.latitude >= SRI_LANKA_MAP_BOUNDS.south &&
    location.latitude <= SRI_LANKA_MAP_BOUNDS.north &&
    location.longitude >= SRI_LANKA_MAP_BOUNDS.west &&
    location.longitude <= SRI_LANKA_MAP_BOUNDS.east
  );
}

export function CitizenIncidentDiscovery({ accessToken, onOpenEvent }: Props) {
  const [section, setSection] = useListState<DiscoverySection>("nearby-activity-v2.section", "upcoming");
  const [events, setEvents] = useListState<MapMarkerFeature[]>("nearby-activity-v2.events", []);
  const [eventDetail, setEventDetail] = useState<CleanupEventPublicDetail>();
  const [incidentDetail, setIncidentDetail] = useState<IncidentDetail>();
  const [selectedId, setSelectedId] = useState<string>();
  const [search, setSearch] = useListState<SearchContext | undefined>("nearby-activity-v2.search", undefined);
  const [focusLocation, setFocusLocation] = useListState<MapLocation | undefined>("nearby-activity-v2.focus", undefined);
  const [searchedBoundary, setSearchedBoundary] =
    useState<MapBoundaryFeatureCollection>();
  const [radiusMeters, setRadiusMeters] = useListState<number>("nearby-activity-v2.radius", 2_000);
  const [nextCursor, setNextCursor] = useListState<string | null>("nearby-activity-v2.cursor", null);
  const [pageCursors, setPageCursors] = useListState<(string | undefined)[]>("nearby-activity-v2.pages", [undefined]);
  const [pageIndex, setPageIndex] = useListState("nearby-activity-v2.page", 0);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string>();
  useListScroll("nearby:" + section + ":" + pageIndex, !loading);
  const requestController = useRef<AbortController | undefined>(undefined);
  const detailController = useRef<AbortController | undefined>(undefined);
  const selectedIdRef = useRef<string | undefined>(undefined);

  const selectEvent = useCallback((id?: string) => {
    if (selectedIdRef.current === id) return;
    selectedIdRef.current = id;
    setSelectedId(id);
    setEventDetail(undefined);
    setIncidentDetail(undefined);
  }, []);

  useEffect(
    () => () => {
      requestController.current?.abort();
      detailController.current?.abort();
    },
    [],
  );

  const runSearch = useCallback(
    async (
      context: SearchContext,
      options: { append?: boolean; cursor?: string; section?: DiscoverySection; pageIndex?: number } = {},
    ) => {
      requestController.current?.abort();
      const controller = new AbortController();
      requestController.current = controller;

      setLoading(true);
      setError(undefined);
      if (!options.append) {
        setEvents([]);
        setNextCursor(null);
        setEventDetail(undefined);
        selectEvent(undefined);
      }
      try {
        const selectedSection = options.section ?? section;
        const query = { ...context.location, radiusMeters: context.radiusMeters, limit: 20, cursor: options.cursor };
        let page: { features: MapMarkerFeature[]; nextCursor: string | null };
        if (selectedSection === "awaiting") {
          const incidents = await listNearbyPublicIncidents(accessToken, { ...query, awaitingCleanup: true }, controller.signal);
          page = {
            nextCursor: incidents.nextCursor,
            features: incidents.items.map(incident => ({
              type: "Feature", geometry: { type: "Point", coordinates: [incident.longitude, incident.latitude] },
              properties: { id: incident.id, kind: "INCIDENT", title: incident.title, status: incident.status,
                category: incident.category.name, occurredAt: incident.reportedAt },
            })),
          };
        } else {
          page = await listNearbyCleanupEventMap(accessToken, { ...query, section: selectedSection }, controller.signal);
        }
        if (controller.signal.aborted) return;

        const loadedEvents = options.append
          ? [...events, ...page.features].filter(
              (event, index, all) =>
                all.findIndex(
                  (candidate) =>
                    candidate.properties.id === event.properties.id,
                ) === index,
            )
          : page.features;
        setEvents(loadedEvents);
        setNextCursor(page.nextCursor);
        const index = options.pageIndex ?? 0;
        setPageIndex(index);
        setPageCursors([...pageCursors.slice(0, index), options.cursor]);

        const currentId = selectedIdRef.current;
        selectEvent(
          currentId &&
            loadedEvents.some((event) => event.properties.id === currentId)
            ? currentId
            : undefined,
        );
      } catch (requestError) {
        if (controller.signal.aborted) return;
        setError(
          describeApiFailure(requestError, "Unable to discover nearby activity.")
            .message,
        );
      } finally {
        if (requestController.current === controller) setLoading(false);
      }
    },
    [accessToken, events, selectEvent, section, pageCursors, setPageIndex, setPageCursors, setEvents, setNextCursor],
  );

  useEffect(() => {
    detailController.current?.abort();
    if (!selectedId) return;

    const controller = new AbortController();
    detailController.current = controller;
    void Promise.resolve().then(async () => {
      if (controller.signal.aborted) return;
      setDetailLoading(true);
      setEventDetail(undefined);
      setIncidentDetail(undefined);
      setError(undefined);
      try {
        if (section === "awaiting") {
          const incident = await getPublicIncident(accessToken, selectedId, controller.signal);
          if (!controller.signal.aborted) setIncidentDetail(incident);
        } else {
          const event = await getPublicCleanupEvent(accessToken, selectedId, controller.signal);
          if (controller.signal.aborted) return;
          setEventDetail(event);
          if (event.incidentId) {
            const incident = await getPublicIncident(accessToken, event.incidentId, controller.signal);
            if (!controller.signal.aborted) setIncidentDetail(incident);
          }
        }
      } catch (requestError: unknown) {
        if (!controller.signal.aborted) setError(describeApiFailure(requestError, "Unable to load activity details.").message);
      } finally {
        if (!controller.signal.aborted) setDetailLoading(false);
      }
    });
    return () => controller.abort();
  }, [accessToken, selectedId, section]);

  const findNearMe = () => {
    if (!("geolocation" in navigator)) {
      setError("This browser does not provide foreground location access.");
      return;
    }
    setLocating(true);
    setError(undefined);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setLocating(false);
        if (!locationInsideSriLanka(location)) {
          setError(
            "Your current position is outside the supported Sri Lanka map area.",
          );
          return;
        }
        const nextSearch: SearchContext = { location, radiusMeters };
        setFocusLocation(location);
        setSearch(nextSearch);
        void runSearch(nextSearch);
      },
      () => {
        setLocating(false);
        setError(
          "Location permission was denied or your current position is unavailable.",
        );
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 10_000 },
    );
  };

  const changeRadius = (nextRadiusMeters: number) => {
    setRadiusMeters(nextRadiusMeters);
    if (!focusLocation) return;
    const nextSearch = {
      location: focusLocation,
      radiusMeters: nextRadiusMeters,
    };
    setSearch(nextSearch);
    void runSearch(nextSearch);
  };

  function changeSection(value: DiscoverySection) {
    requestController.current?.abort();
    detailController.current?.abort();
    setSection(value);
    setEvents([]); setNextCursor(null); selectEvent(undefined); setEventDetail(undefined);
    if (search) void runSearch(search, { section: value });
  }

  const selectedEvent = section !== "awaiting" ? events.find(
    (event) => event.properties.id === selectedId,
  ) : undefined;

  return (
    <section className="citizen-discovery">
      <div className="citizen-discovery-intro">
        <div className="citizen-discovery-actions">
          <button type="button" onClick={findNearMe} disabled={locating}>
            {locating ? "Finding your location..." : "Use my location"}
          </button>
          <button
            type="button"
            className="secondary"
            disabled={!search || loading}
            onClick={() => search && void runSearch(search)}
          >
            {section === "awaiting" ? "Refresh incidents" : "Refresh events"}
          </button>
        </div>
      </div>

      <ListSections value={section} options={discoverySections} onChange={changeSection} />
      <div className="citizen-discovery-search-controls">
        <label htmlFor="cleanup-search-radius">Search radius</label>
        <select
          id="cleanup-search-radius"
          value={radiusMeters}
          disabled={locating}
          onChange={(event) => changeRadius(Number(event.target.value))}
        >
          {RADIUS_OPTIONS.map((radius) => (
            <option key={radius} value={radius}>
              {radius / 1_000} km
            </option>
          ))}
        </select>
        <span>
          {search
            ? `${events.length} ${section === "awaiting" ? "incident" : "published event"}${events.length === 1 ? "" : "s"} loaded`
            : "Location is required before events are loaded"}
        </span>
      </div>

      {error && (
        <div className="citizen-discovery-error" role="alert">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => (search ? void runSearch(search) : findNearMe())}
          >
            {search ? "Retry" : "Try location again"}
          </button>
        </div>
      )}
      {loading && (
        <p
          className="citizen-discovery-loading"
          role="status"
          aria-live="polite"
        >
          <span aria-hidden="true" />
          Loading {section === "awaiting" ? "incidents" : "published cleanup events"} within {radiusMeters / 1_000} km.
        </p>
      )}

      <AdministrativeAreaMapSearch
        accessToken={accessToken}
        onBoundaryChange={setSearchedBoundary}
      />

      <EcoMap
        markers={events}
        boundaries={searchedBoundary}
        selectedMarkerId={selectedId}
        focusLocation={focusLocation}
        selectedLocation={focusLocation}
        searchRadiusMeters={search?.radiusMeters}
        showListFallback
        showMarkerCoordinates={false}
        listTitle={`${section === "awaiting" ? "Incidents awaiting cleanup" : "Cleanup events"} within ${radiusMeters / 1_000} km`}
        showCurrentLocation={false}
        height={560}
        accessibleLabel={section === "awaiting" ? "Incidents awaiting cleanup map" : "Published cleanup event discovery map"}
        onMarkerSelect={(marker) => selectEvent(marker.properties.id)}
        markerActionLabel={(marker) =>
          marker.properties.kind === "INCIDENT" ? `View incident: ${marker.properties.title}` : marker.properties.isJoined
            ? `View event details: ${marker.properties.title}`
            : `Join event: ${marker.properties.title}`
        }
        onMarkerAction={(marker) => marker.properties.kind === "INCIDENT" ? selectEvent(marker.properties.id) : onOpenEvent?.(marker.properties.id)}
      />

      {!search ? (
        <div className="citizen-discovery-empty">
          <strong>Use your location to begin</strong>

        </div>
      ) : !loading && events.length === 0 ? (
        <div className="citizen-discovery-empty">
          <strong>{section === "awaiting" ? "No incidents awaiting cleanup found" : "No published cleanup events found"}</strong>
          <p>Try a larger search radius or refresh the search.</p>
        </div>
      ) : null}

      {search && <PageControls pageNumber={pageIndex + 1} hasPrevious={pageIndex > 0} hasNext={Boolean(nextCursor)} busy={loading}
        previous={() => void runSearch(search, { cursor: pageCursors[pageIndex - 1], pageIndex: pageIndex - 1 })}
        next={() => { if (nextCursor) void runSearch(search, { cursor: nextCursor, pageIndex: pageIndex + 1 }); }} />}

      {selectedEvent && (
        <article className="citizen-discovery-detail">
          <div>
            <span>{selectedEvent.properties.organizationName}</span>
            <h2>{selectedEvent.properties.title}</h2>
            <p>
              {selectedEvent.properties.isJoined
                ? "You joined this event."
                : "Published cleanup event"}
            </p>
          </div>
          {detailLoading ? (
            <p role="status">Loading cleanup event details...</p>
          ) : eventDetail ? (
            <div className="citizen-discovery-detail-body">
              <p>{eventDetail.description}</p>
              {eventDetail.publicInstructions ? (
                <p>
                  <strong>Volunteer instructions:</strong>{" "}
                  {eventDetail.publicInstructions}
                </p>
              ) : null}
              <dl>
                <div>
                  <dt>Status</dt>
                  <dd>{readable(eventDetail.displayStatus)}</dd>
                </div>
                <div>
                  <dt>Location</dt>
                  <dd>
                    {eventDetail.meetingAddress ??
                      eventDetail.eventAddress ??
                      "Map location"}
                  </dd>
                </div>
                <div>
                  <dt>Starts</dt>
                  <dd>{new Date(eventDetail.startsAt).toLocaleString()}</dd>
                </div>
                <div>
                  <dt>Participation</dt>
                  <dd>
                    {selectedEvent.properties.isJoined
                      ? "Joined"
                      : "Not joined"}
                  </dd>
                </div>
              </dl>
              {onOpenEvent && (
                <button
                  className="citizen-discovery-detail-action"
                  type="button"
                  onClick={() => onOpenEvent(selectedEvent.properties.id)}
                >
                  {selectedEvent.properties.isJoined
                    ? "View event details"
                    : "Join event"}
                </button>
              )}
            </div>
          ) : null}
        </article>
      )}
      {section === "awaiting" && selectedId && detailLoading && <p role="status">Loading incident details...</p>}
      {incidentDetail && <IncidentEvidence incident={incidentDetail} awaitingCleanup={section === "awaiting"} />}
    </section>
  );
}
