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

type Props = {
  accessToken: string;
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

export function CitizenIncidentDiscovery({ accessToken }: Props) {
  const [categories, setCategories] = useState<IncidentCategory[]>([]);
  const [incidents, setIncidents] = useState<PublicIncidentSummary[]>([]);
  const [detail, setDetail] = useState<IncidentDetail>();
  const [selectedId, setSelectedId] = useState<string>();
  const [search, setSearch] = useState<SearchContext>();
  const [focusLocation, setFocusLocation] = useState<MapLocation>();
  const [status, setStatus] = useState<"" | IncidentStatus>("");
  const [categoryId, setCategoryId] = useState("");
  const [timeRange, setTimeRange] =
    useState<(typeof timeOptions)[number]["value"]>("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string>();
  const requestController = useRef<AbortController | undefined>(undefined);
  const detailController = useRef<AbortController | undefined>(undefined);
  const ignoreNextFocusedViewport = useRef(false);

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
        const page = context.mode === "viewport"
          ? await listPublicIncidents(
              accessToken,
              { ...context.viewport, ...filters },
              controller.signal,
            )
          : await listNearbyPublicIncidents(
              accessToken,
              { ...context.location, radiusMeters: context.radiusMeters, ...filters },
              controller.signal,
            );
        if (controller.signal.aborted) return;

        setIncidents((current) =>
          options.append ? mergeUnique(current, page.items) : page.items,
        );
        setSelectedId((selected) => {
          if (options.append && selected) return selected;
          return page.items.some((incident) => incident.id === selected)
            ? selected
            : page.items[0]?.id;
        });
        setNextCursor(page.nextCursor);
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
    [accessToken, categoryId, status, timeRange],
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
    void Promise.resolve()
      .then(() => {
        if (controller.signal.aborted) return undefined;
        setDetailLoading(true);
        setDetail(undefined);
        return getPublicIncident(accessToken, selectedId, controller.signal);
      })
      .then((loaded) => {
        if (!controller.signal.aborted && loaded) setDetail(loaded);
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
  }, [accessToken, selectedId]);

  const markers = useMemo<MapMarkerFeature[]>(
    () => incidents.map((incident) => ({
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
      },
    })),
    [incidents],
  );

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

  return (
    <section className="citizen-discovery">
      <div className="citizen-discovery-intro">
        <div>
          <span>FIND CLEANUP ACTIVITY</span>
          <h1>Discover environmental incidents nearby</h1>
          <p>
            Explore current reports in the visible map area or request your
            foreground location once to search within five kilometres.
          </p>
        </div>
        <div className="citizen-discovery-actions">
          <button type="button" onClick={findNearMe} disabled={locating}>
            {locating ? "Finding your location…" : "Find incidents near me"}
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
          onMarkerSelect={(marker) => setSelectedId(marker.properties.id)}
          onViewportChange={handleViewportChange}
        />

        <aside className="citizen-discovery-list" aria-label="Environmental incidents">
          <div className="citizen-discovery-list-heading">
            <strong>{search?.mode === "nearby" ? "Within 5 km" : "Visible map area"}</strong>
            <span>{loading ? "Loading…" : `${incidents.length} found`}</span>
          </div>
          {!loading && incidents.length === 0 ? (
            <div className="citizen-discovery-empty">
              <strong>No incidents found</strong>
              <p>Move the map, widen the filters, or refresh the search.</p>
            </div>
          ) : incidents.map((incident) => (
            <button
              key={incident.id}
              type="button"
              className={incident.id === selectedId ? "selected" : undefined}
              onClick={() => setSelectedId(incident.id)}
            >
              <span>{incident.category.name}</span>
              <strong>{incident.title}</strong>
              <small>{readable(incident.severity)} · {readable(incident.status)}</small>
            </button>
          ))}
          {nextCursor && search && (
            <button
              type="button"
              className="citizen-discovery-more"
              disabled={loading}
              onClick={() => void runSearch(search, { append: true, cursor: nextCursor })}
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
    </section>
  );
}
