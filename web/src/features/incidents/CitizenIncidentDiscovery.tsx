import { useCallback, useEffect, useRef, useState } from "react";

import { describeApiFailure } from "../../api/apiError";
import { getPublicCleanupEvent, listNearbyCleanupEventMap } from "../cleanup-events/cleanupEvent.api";
import type { CleanupEventMapFeature, CleanupEventPublicDetail } from "../cleanup-events/cleanupEvent.types";
import {
  EcoMap,
  SRI_LANKA_MAP_BOUNDS,
  type MapLocation,
} from "../maps";
import "./citizenIncidentDiscovery.css";

type Props = {
  accessToken: string;
  onOpenEvent?: (eventId: string) => void;
};

type SearchContext = { location: MapLocation; radiusMeters: number };

const RADIUS_OPTIONS = [2_000, 5_000, 10_000, 25_000] as const;

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
  const [radiusMeters, setRadiusMeters] = useState<number>(RADIUS_OPTIONS[0]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string>();
  const requestController = useRef<AbortController | undefined>(undefined);
  const detailController = useRef<AbortController | undefined>(undefined);
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
      options: { append?: boolean; cursor?: string } = {},
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
        const page = await listNearbyCleanupEventMap(accessToken, {
          ...context.location,
          radiusMeters: context.radiusMeters,
          limit: 50,
          cursor: options.cursor,
        }, controller.signal);
        if (controller.signal.aborted) return;

        const loadedEvents = options.append
          ? [...events, ...page.features].filter(
              (event, index, all) => all.findIndex(
                (candidate) => candidate.properties.id === event.properties.id,
              ) === index,
            )
          : page.features;
        setEvents(loadedEvents);
        setNextCursor(page.nextCursor);
        const currentId = selectedIdRef.current;
        selectEvent(currentId && loadedEvents.some((event) => event.properties.id === currentId)
          ? currentId
          : undefined);
      } catch (requestError) {
        if (controller.signal.aborted) return;
        setError(describeApiFailure(requestError, "Unable to discover cleanup events.").message);
      } finally {
        if (requestController.current === controller) setLoading(false);
      }
    },
    [accessToken, events, selectEvent],
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
        const nextSearch: SearchContext = { location, radiusMeters };
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

  const changeRadius = (nextRadiusMeters: number) => {
    setRadiusMeters(nextRadiusMeters);
    if (!focusLocation) return;
    const nextSearch = { location: focusLocation, radiusMeters: nextRadiusMeters };
    setSearch(nextSearch);
    void runSearch(nextSearch);
  };

  const selectedEvent = events.find((event) => event.properties.id === selectedId);

  return (
    <section className="citizen-discovery">
      <div className="citizen-discovery-intro">
        <div>
          <span>FIND CLEANUP ACTIVITY</span>
          <h1>Find cleanup activity nearby</h1>
          <p>Use your current location to find published cleanup events within a distance you choose.</p>
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

      <div className="citizen-discovery-search-controls">
        <label htmlFor="cleanup-search-radius">Search radius</label>
        <select
          id="cleanup-search-radius"
          value={radiusMeters}
          disabled={locating}
          onChange={(event) => changeRadius(Number(event.target.value))}
        >
          {RADIUS_OPTIONS.map((radius) => (
            <option key={radius} value={radius}>{radius / 1_000} km</option>
          ))}
        </select>
        <span>{search ? `${events.length} published event${events.length === 1 ? "" : "s"} loaded` : "Location is required before events are loaded"}</span>
      </div>

      {error && <div className="citizen-discovery-error" role="alert"><span>{error}</span><button type="button" onClick={() => search ? void runSearch(search) : findNearMe()}>{search ? "Retry" : "Try location again"}</button></div>}
      {loading && (
        <p className="citizen-discovery-loading" role="status" aria-live="polite">
          <span aria-hidden="true" />
          Loading published cleanup events within {radiusMeters / 1_000} km.
        </p>
      )}

      <EcoMap
        markers={events}
        selectedMarkerId={selectedId}
        focusLocation={focusLocation}
        selectedLocation={focusLocation}
        searchRadiusMeters={search?.radiusMeters}
        showListFallback
        listTitle={`Cleanup events within ${radiusMeters / 1_000} km`}
        showCurrentLocation={false}
        height={560}
        accessibleLabel="Published cleanup event discovery map"
        onMarkerSelect={(marker) => selectEvent(marker.properties.id)}
        markerActionLabel={(marker) => marker.properties.isJoined
          ? `View event details: ${marker.properties.title}`
          : `Join event: ${marker.properties.title}`}
        onMarkerAction={(marker) => onOpenEvent?.(marker.properties.id)}
      />

      {!search ? (
        <div className="citizen-discovery-empty"><strong>Use your location to begin</strong><p>EcoTrack will only request published cleanup events inside your selected radius.</p></div>
      ) : !loading && events.length === 0 ? (
        <div className="citizen-discovery-empty"><strong>No published cleanup events found</strong><p>Try a larger search radius or refresh the search.</p></div>
      ) : null}

      {nextCursor && search ? (
        <button
          className="citizen-discovery-more"
          type="button"
          disabled={loading}
          onClick={() => void runSearch(search, { append: true, cursor: nextCursor })}
        >
          {loading ? "Loading..." : "Load more events"}
        </button>
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
