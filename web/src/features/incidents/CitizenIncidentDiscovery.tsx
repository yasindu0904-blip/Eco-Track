import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { describeApiFailure } from "../../api/apiError";
import {
  EcoMap,
  SRI_LANKA_MAP_BOUNDS,
  type MapLocation,
  type MapMarkerFeature,
  type MapViewport,
  type MapViewportChangeHandler,
} from "../maps";
import {
  getPublicIncident,
  listIncidentCategories,
  listNearbyPublicIncidents,
  listPublicIncidents,
} from "./incident.api";
import type {
  IncidentCategory,
  IncidentDetail,
  IncidentStatus,
  PublicIncidentSummary,
} from "./incident.types";
import "./citizenIncidentDiscovery.css";
import { getPublicCleanupEvent, listNearbyCleanupEventMap, listPublicCleanupEventMap } from "../cleanup-events/cleanupEvent.api";
import type { CleanupEventMapFeature, CleanupEventPublicDetail } from "../cleanup-events/cleanupEvent.types";

type Props = {
  accessToken: string;
  onOpenEvent?: (eventId: string) => void;
};

type SearchContext =
  | { mode: "viewport"; viewport: MapViewport }
  | { mode: "nearby"; location: MapLocation; radiusMeters: number };

const statusOptions: Array<{ value: "" | IncidentStatus; label: string }> = [
  { value: "", label: "All current" },
  { value: "ACTIVE", label: "Active" },
  { value: "CLEANUP_ORGANIZED", label: "Cleanup organized" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "EXPIRED", label: "Expired" },
];

const timeOptions = [
  { value: "", label: "Any time", milliseconds: 0 },
  { value: "24h", label: "Last 24 hours", milliseconds: 24 * 60 * 60 * 1000 },
  { value: "7d", label: "Last 7 days", milliseconds: 7 * 24 * 60 * 60 * 1000 },
  { value: "30d", label: "Last 30 days", milliseconds: 30 * 24 * 60 * 60 * 1000 },
] as const;

function readable(value: string): string {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function reportedAfterFor(value: (typeof timeOptions)[number]["value"]): string | undefined {
  const option = timeOptions.find((candidate) => candidate.value === value);
  return option?.milliseconds
    ? new Date(Date.now() - option.milliseconds).toISOString()
    : undefined;
}

function locationInsideSriLanka(location: MapLocation): boolean {
  return (
    location.latitude >= SRI_LANKA_MAP_BOUNDS.south &&
    location.latitude <= SRI_LANKA_MAP_BOUNDS.north &&
    location.longitude >= SRI_LANKA_MAP_BOUNDS.west &&
    location.longitude <= SRI_LANKA_MAP_BOUNDS.east
  );
}

function mergeUnique(
  current: PublicIncidentSummary[],
  incoming: PublicIncidentSummary[],
): PublicIncidentSummary[] {
  const items = new Map(current.map((item) => [item.id, item]));
  incoming.forEach((item) => items.set(item.id, item));
  return [...items.values()];
}

export function CitizenIncidentDiscovery({ accessToken, onOpenEvent }: Props) {
  const [categories, setCategories] = useState<IncidentCategory[]>([]);
  const [incidents, setIncidents] = useState<PublicIncidentSummary[]>([]);
  const [events, setEvents] = useState<CleanupEventMapFeature[]>([]);
  const [detail, setDetail] = useState<IncidentDetail>();
  const [eventDetail, setEventDetail] = useState<CleanupEventPublicDetail>();
  const [selectedId, setSelectedId] = useState<string>();
  const [selectedKind, setSelectedKind] = useState<"INCIDENT" | "CLEANUP_EVENT">("INCIDENT");
  const [search, setSearch] = useState<SearchContext>();
  const [focusLocation, setFocusLocation] = useState<MapLocation>();
  const [status, setStatus] = useState<"" | IncidentStatus>("");
  const [categoryId, setCategoryId] = useState("");
  const [timeRange, setTimeRange] =
    useState<(typeof timeOptions)[number]["value"]>("");
  const [activityKind, setActivityKind] = useState<"ALL" | "INCIDENT" | "CLEANUP_EVENT">("ALL");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [nextEventCursor, setNextEventCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string>();
  const requestController = useRef<AbortController | undefined>(undefined);
  const detailController = useRef<AbortController | undefined>(undefined);
  const ignoreNextFocusedViewport = useRef(false);
  const selectedIdRef = useRef<string | undefined>(undefined);

  const selectMarker = useCallback((id: string | undefined, kind: "INCIDENT" | "CLEANUP_EVENT" = "INCIDENT") => {
    selectedIdRef.current = id;
    setSelectedId(id);
    setSelectedKind(kind);
  }, []);

  useEffect(() => {
    let active = true;
    void listIncidentCategories(accessToken)
      .then((loaded) => {
        if (active) setCategories(loaded);
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(
            describeApiFailure(
              requestError,
              "Unable to load incident categories.",
            ).message,
          );
        }
      });
    return () => {
      active = false;
    };
  }, [accessToken]);

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
      options: {
        append?: boolean;
        cursor?: string;
        eventCursor?: string;
        externalSignal?: AbortSignal;
      } = {},
    ) => {
      requestController.current?.abort();
      const controller = new AbortController();
      requestController.current = controller;
      const abortFromExternal = () => controller.abort();
      options.externalSignal?.addEventListener("abort", abortFromExternal, {
        once: true,
      });
      if (options.externalSignal?.aborted) controller.abort();

      setLoading(true);
      setError(undefined);
      const filters = {
        limit: 50,
        cursor: options.cursor,
        status: status || undefined,
        categoryId: categoryId || undefined,
        reportedAfter: reportedAfterFor(timeRange),
      };

      try {
        const incidentRequest = options.append && !options.cursor
          ? Promise.resolve({ items: [], nextCursor: null })
          : context.mode === "viewport"
            ? listPublicIncidents(
              accessToken,
              { ...context.viewport, ...filters },
              controller.signal,
            )
            : listNearbyPublicIncidents(
              accessToken,
              { ...context.location, radiusMeters: context.radiusMeters, ...filters },
              controller.signal,
            );
        const eventRequest = options.append && !options.eventCursor
          ? Promise.resolve({ type: "FeatureCollection" as const, features: [], nextCursor: null })
          : context.mode === "viewport"
            ? listPublicCleanupEventMap(accessToken, {
                ...context.viewport, limit: 50, cursor: options.eventCursor,
              }, controller.signal)
            : listNearbyCleanupEventMap(accessToken, {
              ...context.location, radiusMeters: context.radiusMeters, limit: 50, cursor: options.eventCursor,
            }, controller.signal);
        const [page, eventPage] = await Promise.all([incidentRequest, eventRequest]);
        if (controller.signal.aborted) return;

        setIncidents((current) =>
          options.append ? mergeUnique(current, page.items) : page.items,
        );
        setEvents((current) => options.append
          ? [...new Map([...current, ...eventPage.features].map((item) => [item.properties.id, item])).values()]
          : eventPage.features);
        if (!options.append || !selectedIdRef.current) {
          const currentId = selectedIdRef.current;
          if (currentId && page.items.some((incident) => incident.id === currentId)) {
            selectMarker(currentId, "INCIDENT");
          } else if (currentId && eventPage.features.some((event) => event.properties.id === currentId)) {
            selectMarker(currentId, "CLEANUP_EVENT");
          } else if (page.items[0]) {
            selectMarker(page.items[0].id, "INCIDENT");
          } else if (eventPage.features[0]) {
            selectMarker(eventPage.features[0].properties.id, "CLEANUP_EVENT");
          } else {
            selectMarker(undefined);
          }
        }
        setNextCursor(page.nextCursor);
        setNextEventCursor(eventPage.nextCursor);
      } catch (requestError) {
        if (controller.signal.aborted) return;
        setError(
          describeApiFailure(
            requestError,
            "Unable to discover cleanup activity.",
          ).message,
        );
      } finally {
        options.externalSignal?.removeEventListener("abort", abortFromExternal);
        if (requestController.current === controller) setLoading(false);
      }
    },
    [accessToken, categoryId, selectMarker, status, timeRange],
  );

  const handleViewportChange = useCallback<MapViewportChangeHandler>(
    (viewport, context) => {
      if (ignoreNextFocusedViewport.current) {
        ignoreNextFocusedViewport.current = false;
        return;
      }
      const nextSearch: SearchContext = { mode: "viewport", viewport };
      setSearch(nextSearch);
      return runSearch(nextSearch, { externalSignal: context.signal });
    },
    [runSearch],
  );

  useEffect(() => {
    detailController.current?.abort();
    if (!selectedId) {
      return;
    }
    const controller = new AbortController();
    detailController.current = controller;
    void Promise.resolve<void>(undefined)
      .then<IncidentDetail | CleanupEventPublicDetail | undefined>(() => {
        if (controller.signal.aborted) return undefined;
        setDetailLoading(true);
        setDetail(undefined);
        setEventDetail(undefined);
        return selectedKind === "INCIDENT"
          ? getPublicIncident(accessToken, selectedId, controller.signal)
          : getPublicCleanupEvent(accessToken, selectedId, controller.signal);
      })
      .then((loaded) => {
        if (!controller.signal.aborted && loaded) {
          if (selectedKind === "INCIDENT") setDetail(loaded as IncidentDetail);
          else setEventDetail(loaded as CleanupEventPublicDetail);
        }
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            describeApiFailure(
              requestError,
              "Unable to load incident details.",
            ).message,
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailLoading(false);
      });
    return () => controller.abort();
  }, [accessToken, selectedId, selectedKind]);

  const markers = useMemo<MapMarkerFeature[]>(
    () => [...(activityKind === "CLEANUP_EVENT" ? [] : incidents.map((incident) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [incident.longitude, incident.latitude],
      },
      properties: {
        id: incident.id,
        kind: "INCIDENT",
        title: incident.title,
        status: readable(incident.status),
        category: incident.category.name,
        occurredAt: incident.reportedAt,
        isOwnReport: incident.isOwnReport,
      },
    } satisfies MapMarkerFeature))), ...(activityKind === "INCIDENT" ? [] : events)],
    [activityKind, events, incidents],
  );

  const changeActivityKind = (next: typeof activityKind) => {
    setActivityKind(next);
    if (next === "ALL" || selectedKind === next) return;
    if (next === "INCIDENT") selectMarker(incidents[0]?.id, "INCIDENT");
    else selectMarker(events[0]?.properties.id, "CLEANUP_EVENT");
  };

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
        const nextSearch: SearchContext = {
          mode: "nearby",
          location,
          radiusMeters: 5_000,
        };
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

  const selected = incidents.find((incident) => incident.id === selectedId);
  const selectedEvent = events.find((event) => event.properties.id === selectedId);

  return (
    <section className="citizen-discovery">
      <div className="citizen-discovery-intro">
        <div>
          <span>FIND CLEANUP ACTIVITY</span>
          <h1>Discover environmental incidents nearby</h1>
          <p>
            Explore current reports and published cleanup events in the visible map area or request your
            foreground location once to search within five kilometres.
          </p>
        </div>
        <div className="citizen-discovery-actions">
          <button type="button" onClick={findNearMe} disabled={locating}>
            {locating ? "Finding your location…" : "Find activity near me"}
          </button>
          <button
            type="button"
            className="secondary"
            disabled={!search || loading}
            onClick={() => search && void runSearch(search)}
          >
            Refresh results
          </button>
        </div>
      </div>

      <div className="citizen-discovery-filters">
        <label>
          Activity
          <select value={activityKind} onChange={(event) => changeActivityKind(event.target.value as typeof activityKind)}>
            <option value="ALL">Incidents and events</option>
            <option value="INCIDENT">Incidents only</option>
            <option value="CLEANUP_EVENT">Cleanup events only</option>
          </select>
        </label>
        <label>
          Status
          <select value={status} onChange={(event) => setStatus(event.target.value as "" | IncidentStatus)}>
            {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label>
          Category
          <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="">All categories</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
        <label>
          Reported
          <select value={timeRange} onChange={(event) => setTimeRange(event.target.value as (typeof timeOptions)[number]["value"])}>
            {timeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <button type="button" disabled={!search || loading} onClick={() => search && void runSearch(search)}>
          Apply filters
        </button>
      </div>

      {error && <div className="citizen-discovery-error" role="alert"><span>{error}</span><button type="button" onClick={() => search && void runSearch(search)}>Retry</button></div>}

      <div className="citizen-discovery-layout">
        <EcoMap
          markers={markers}
          selectedMarkerId={selectedId}
          focusLocation={focusLocation}
          showListFallback={false}
          height={560}
          accessibleLabel="Citizen cleanup activity discovery map"
          onMarkerSelect={(marker) => selectMarker(marker.properties.id, marker.properties.kind)}
          onViewportChange={handleViewportChange}
        />

        <aside className="citizen-discovery-list" aria-label="Environmental incidents">
          <div className="citizen-discovery-list-heading">
            <strong>{search?.mode === "nearby" ? "Within 5 km" : "Visible map area"}</strong>
            <span>{loading ? "Loading…" : `${markers.length} found`}</span>
          </div>
          {!loading && markers.length === 0 ? (
            <div className="citizen-discovery-empty">
              <strong>No incidents found</strong>
              <p>Move the map, widen the filters, or refresh the search.</p>
            </div>
          ) : activityKind === "CLEANUP_EVENT" ? null : incidents.map((incident) => (
            <button
              key={incident.id}
              type="button"
              className={incident.id === selectedId ? "selected" : undefined}
              onClick={() => selectMarker(incident.id, "INCIDENT")}
            >
              <span>{incident.category.name}{incident.isOwnReport ? " · Your report" : ""}</span>
              <strong>{incident.title}</strong>
              <small>{readable(incident.severity)} · {readable(incident.status)}</small>
            </button>
          ))}
          {activityKind !== "INCIDENT" && events.map((event) => (
            <button key={`event-${event.properties.id}`} type="button"
              className={event.properties.id === selectedId ? "selected" : undefined}
              onClick={() => selectMarker(event.properties.id, "CLEANUP_EVENT")}>
              <span>Cleanup event{event.properties.isJoined ? " · Joined" : ""}</span>
              <strong>{event.properties.title}</strong>
              <small>{event.properties.organizationName} · {readable(event.properties.status)}</small>
            </button>
          ))}
          {(nextCursor || nextEventCursor) && search && (
            <button
              type="button"
              className="citizen-discovery-more"
              disabled={loading}
              onClick={() => void runSearch(search, { append: true, cursor: nextCursor ?? undefined, eventCursor: nextEventCursor ?? undefined })}
            >
              {loading ? "Loading…" : "Load more"}
            </button>
          )}
        </aside>
      </div>

      {selected && (
        <article className="citizen-discovery-detail">
          <div>
            <span>{selected.category.name}</span>
            <h2>{selected.title}</h2>
            <p>{selected.addressText ?? `${selected.latitude.toFixed(5)}, ${selected.longitude.toFixed(5)}`}</p>
          </div>
          {detailLoading ? <p>Loading public details…</p> : detail ? (
            <div className="citizen-discovery-detail-body">
              <p>{detail.description}</p>
              <dl>
                <div><dt>Status</dt><dd>{readable(detail.status)}</dd></div>
                <div><dt>Severity</dt><dd>{readable(detail.severity)}</dd></div>
                <div><dt>Public false count</dt><dd>{selected.falseReviewCount}</dd></div>
              </dl>
            </div>
          ) : null}
        </article>
      )}
      {selectedKind === "CLEANUP_EVENT" && selectedEvent && (
        <article className="citizen-discovery-detail">
          <div>
            <span>{selectedEvent.properties.organizationName}</span>
            <h2>{selectedEvent.properties.title}</h2>
            <p>{selectedEvent.properties.isJoined ? "You joined this event." : "Published cleanup event"}</p>
          </div>
          {detailLoading ? <p>Loading event details…</p> : eventDetail ? (
            <div className="citizen-discovery-detail-body">
              <p>{eventDetail.description}</p>
              <dl>
                <div><dt>Status</dt><dd>{readable(eventDetail.lifecycleStatus)}</dd></div>
                <div><dt>Address</dt><dd>{eventDetail.eventAddress ?? "Map location"}</dd></div>
                <div><dt>Sessions</dt><dd>{eventDetail.sessions.length}</dd></div>
              </dl>
              {onOpenEvent && <button type="button" onClick={() => onOpenEvent(selectedEvent.properties.id)}>Open full event details</button>}
            </div>
          ) : null}
        </article>
      )}
    </section>
  );
}
