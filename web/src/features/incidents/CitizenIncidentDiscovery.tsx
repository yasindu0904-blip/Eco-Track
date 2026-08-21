import { useCallback, useEffect, useRef, useState } from "react";

import { describeApiFailure } from "../../api/apiError";
import { getPublicCleanupEvent, listNearbyCleanupEventMap, listPublicCleanupEventMap } from "../cleanup-events/cleanupEvent.api";
import type { CleanupEventMapFeature, CleanupEventPublicDetail } from "../cleanup-events/cleanupEvent.types";
import {
  COLOMBO_MAP_CENTER,
  EcoMap,
  SRI_LANKA_MAP_BOUNDS,
  type MapLocation,
  type MapViewport,
  type MapViewportChangeHandler,
} from "../maps";
import "./citizenIncidentDiscovery.css";

type Props = {
  accessToken: string;
  onOpenEvent?: (eventId: string) => void;
};

type SearchContext =
  | { mode: "viewport"; viewport: MapViewport }
  | { mode: "nearby"; location: MapLocation; radiusMeters: number };

function readable(value: string): string {
  return value.toLowerCase().replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
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
  const [events, setEvents] = useState<CleanupEventMapFeature[]>([]);
  const [eventDetail, setEventDetail] = useState<CleanupEventPublicDetail>();
  const [selectedId, setSelectedId] = useState<string>();
  const [search, setSearch] = useState<SearchContext>();
  const [focusLocation, setFocusLocation] = useState<MapLocation>();
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string>();
  const requestController = useRef<AbortController | undefined>(undefined);
  const detailController = useRef<AbortController | undefined>(undefined);
  const ignoreNextFocusedViewport = useRef(false);
  const selectedIdRef = useRef<string | undefined>(undefined);

  const selectEvent = useCallback((id?: string) => {
    selectedIdRef.current = id;
    setSelectedId(id);
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
      options: { externalSignal?: AbortSignal } = {},
    ) => {
      requestController.current?.abort();
      const controller = new AbortController();
      requestController.current = controller;
      const abortFromExternal = () => controller.abort();
      options.externalSignal?.addEventListener("abort", abortFromExternal, { once: true });
      if (options.externalSignal?.aborted) controller.abort();

      setLoading(true);
      setError(undefined);
      try {
        const loadedEvents: CleanupEventMapFeature[] = [];
        let cursor: string | undefined;
        const seenCursors = new Set<string>();
        let shouldLoad = true;

        while (shouldLoad) {
          const page = context.mode === "viewport"
            ? await listPublicCleanupEventMap(accessToken, {
                ...context.viewport,
                limit: 50,
                cursor,
              }, controller.signal)
            : await listNearbyCleanupEventMap(accessToken, {
                ...context.location,
                radiusMeters: context.radiusMeters,
                limit: 50,
                cursor,
              }, controller.signal);
          if (controller.signal.aborted) return;

          loadedEvents.push(...page.features);
          const nextCursor = page.nextCursor ?? undefined;
          if (nextCursor && !seenCursors.has(nextCursor)) {
            seenCursors.add(nextCursor);
            cursor = nextCursor;
          } else {
            shouldLoad = false;
          }
        }

        setEvents(loadedEvents);
        const currentId = selectedIdRef.current;
        selectEvent(currentId && loadedEvents.some((event) => event.properties.id === currentId)
          ? currentId
          : undefined);
      } catch (requestError) {
        if (controller.signal.aborted) return;
        setError(describeApiFailure(requestError, "Unable to discover cleanup events.").message);
      } finally {
        options.externalSignal?.removeEventListener("abort", abortFromExternal);
        if (requestController.current === controller) setLoading(false);
      }
    },
    [accessToken, selectEvent],
  );

  const handleViewportChange = useCallback<MapViewportChangeHandler>(
    (viewport, context) => {
      if (ignoreNextFocusedViewport.current) return;
      const nextSearch: SearchContext = { mode: "viewport", viewport };
      setSearch(nextSearch);
      return runSearch(nextSearch, { externalSignal: context.signal });
    },
    [runSearch],
  );

  useEffect(() => {
    detailController.current?.abort();
    if (!selectedId) return;

    const controller = new AbortController();
    detailController.current = controller;
    void Promise.resolve()
      .then(() => {
        if (controller.signal.aborted) return undefined;
        setDetailLoading(true);
        setEventDetail(undefined);
        return getPublicCleanupEvent(accessToken, selectedId, controller.signal);
      })
      .then((loaded) => {
        if (!controller.signal.aborted && loaded) setEventDetail(loaded);
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) {
          setError(describeApiFailure(requestError, "Unable to load cleanup event details.").message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailLoading(false);
      });
    return () => controller.abort();
  }, [accessToken, selectedId]);

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
          setError("Your current position is outside the supported Sri Lanka map area.");
          return;
        }
        const nextSearch: SearchContext = { mode: "nearby", location, radiusMeters: 2_000 };
        ignoreNextFocusedViewport.current = true;
        window.setTimeout(() => {
          ignoreNextFocusedViewport.current = false;
        }, 1_500);
        setFocusLocation(location);
        setSearch(nextSearch);
        void runSearch(nextSearch);
      },
      () => {
        setLocating(false);
        setError("Location permission was denied or your current position is unavailable.");
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 10_000 },
    );
  };

  const selectedEvent = events.find((event) => event.properties.id === selectedId);

  return (
    <section className="citizen-discovery">
      <div className="citizen-discovery-intro">
        <div>
          <span>FIND CLEANUP ACTIVITY</span>
          <h1>Find cleanup activity nearby</h1>
          <p>Explore published cleanup events in the visible map area or use your location to search within two kilometres.</p>
        </div>
        <div className="citizen-discovery-actions">
          <button type="button" onClick={findNearMe} disabled={locating}>
            {locating ? "Finding your location..." : "Use my location"}
          </button>
          <button type="button" className="secondary" disabled={!search || loading} onClick={() => search && void runSearch(search)}>
            Refresh events
          </button>
        </div>
      </div>

      {error && <div className="citizen-discovery-error" role="alert"><span>{error}</span><button type="button" onClick={() => search && void runSearch(search)}>Retry</button></div>}
      {loading && (
        <p className="citizen-discovery-loading" role="status" aria-live="polite">
          <span aria-hidden="true" />
          Loading published cleanup events{search?.mode === "nearby" ? " within 2 km" : " for the current map view"}. Visible results may change until loading is complete.
        </p>
      )}

      <EcoMap
        markers={events}
        selectedMarkerId={selectedId}
        focusLocation={focusLocation}
        selectedLocation={focusLocation ?? COLOMBO_MAP_CENTER}
        searchRadiusMeters={search?.mode === "nearby" ? 2_000 : undefined}
        showListFallback={false}
        showCurrentLocation={false}
        height={560}
        accessibleLabel="Published cleanup event discovery map"
        onMarkerSelect={(marker) => selectEvent(marker.properties.id)}
        markerActionLabel={(marker) => marker.properties.isJoined
          ? `View event details: ${marker.properties.title}`
          : `Join event: ${marker.properties.title}`}
        onMarkerAction={(marker) => onOpenEvent?.(marker.properties.id)}
        onViewportChange={handleViewportChange}
      />

      {!loading && events.length === 0 ? (
        <div className="citizen-discovery-empty"><strong>No published cleanup events found</strong><p>Move the map or refresh the search.</p></div>
      ) : null}

      {selectedEvent && (
        <article className="citizen-discovery-detail">
          <div>
            <span>{selectedEvent.properties.organizationName}</span>
            <h2>{selectedEvent.properties.title}</h2>
            <p>{selectedEvent.properties.isJoined ? "You joined this event." : "Published cleanup event"}</p>
          </div>
          {detailLoading ? <p role="status">Loading cleanup event details...</p> : eventDetail ? (
            <div className="citizen-discovery-detail-body">
              <p>{eventDetail.description}</p>
              {eventDetail.publicInstructions ? <p><strong>Volunteer instructions:</strong> {eventDetail.publicInstructions}</p> : null}
              <dl>
                <div><dt>Status</dt><dd>{readable(eventDetail.lifecycleStatus)}</dd></div>
                <div><dt>Location</dt><dd>{eventDetail.meetingAddress ?? eventDetail.eventAddress ?? "Map location"}</dd></div>
                <div><dt>Sessions</dt><dd>{eventDetail.sessions.length}</dd></div>
                <div><dt>Participation</dt><dd>{selectedEvent.properties.isJoined ? "Joined" : "Not joined"}</dd></div>
              </dl>
              {onOpenEvent && <button className="citizen-discovery-detail-action" type="button" onClick={() => onOpenEvent(selectedEvent.properties.id)}>{selectedEvent.properties.isJoined ? "View event details" : "Join event"}</button>}
            </div>
          ) : null}
        </article>
      )}
    </section>
  );
}
