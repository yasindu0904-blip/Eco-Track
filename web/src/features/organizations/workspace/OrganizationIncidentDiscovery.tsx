import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { describeApiFailure } from "../../../api/apiError";
import { listIncidentCategories } from "../../incidents/incident.api";
import type { IncidentCategory } from "../../incidents/incident.types";
import { getPublicCleanupEvent, listOrganizationCleanupEventMap } from "../../cleanup-events/cleanupEvent.api";
import type { CleanupEventPublicDetail, CleanupEventMapFeature } from "../../cleanup-events/cleanupEvent.types";
import {
  AdministrativeAreaMapSearch,
  EcoMap,
  type MapBoundaryFeatureCollection,
  type MapMarkerFeature,
  type MapViewport,
  type MapViewportChangeHandler,
} from "../../maps";
import {
  getOrganizationIncidentDetail,
  listOrganizationIncidents,
  listOrganizationServiceAreaBoundaries,
  updateOrganizationIncidentReview,
} from "./organizationIncidentDiscovery.api";
import type {
  OrganizationIncidentDetail,
  OrganizationIncidentFalseReasonCode,
  OrganizationIncidentReviewStatus,
  OrganizationIncidentSummary,
} from "./organizationIncidentDiscovery.types";

interface OrganizationIncidentDiscoveryProps {
  accessToken: string;
  organizationId: string;
  canReview: boolean;
  onCreateDraftFromIncident?: (incidentId: string) => void;
  onOpenEvent?: (eventId: string, lifecycleStatus: string) => void;
}

const statusOptions = [
  { value: "", label: "All current" },
  { value: "ACTIVE", label: "Active" },
  { value: "CLEANUP_ORGANIZED", label: "Cleanup organized" },
] as const;

const timeOptions = [
  { value: "", label: "Any time", milliseconds: 0 },
  { value: "24h", label: "Last 24 hours", milliseconds: 24 * 60 * 60 * 1000 },
  { value: "7d", label: "Last 7 days", milliseconds: 7 * 24 * 60 * 60 * 1000 },
  {
    value: "30d",
    label: "Last 30 days",
    milliseconds: 30 * 24 * 60 * 60 * 1000,
  },
] as const;

const reviewReasonOptions: Array<{
  value: OrganizationIncidentFalseReasonCode;
  label: string;
}> = [
  { value: "INSUFFICIENT_EVIDENCE", label: "Insufficient evidence" },
  { value: "LOCATION_INCORRECT", label: "Location is incorrect" },
  { value: "DUPLICATE_REPORT", label: "Duplicate report" },
  {
    value: "NOT_AN_ENVIRONMENTAL_INCIDENT",
    label: "Not an environmental incident",
  },
  { value: "OUTSIDE_SERVICE_SCOPE", label: "Outside service scope" },
  { value: "OTHER", label: "Other" },
];

type DiscoveryFilters = {
  status: (typeof statusOptions)[number]["value"];
  categoryId: string;
  timeRange: (typeof timeOptions)[number]["value"];
};

function reportedAfterFor(
  value: DiscoveryFilters["timeRange"],
): string | undefined {
  const option = timeOptions.find((candidate) => candidate.value === value);
  return option?.milliseconds
    ? new Date(Date.now() - option.milliseconds).toISOString()
    : undefined;
}

function mergeUnique(
  current: OrganizationIncidentSummary[],
  incoming: OrganizationIncidentSummary[],
): OrganizationIncidentSummary[] {
  const byId = new Map(current.map((incident) => [incident.id, incident]));
  incoming.forEach((incident) => byId.set(incident.id, incident));
  return [...byId.values()];
}

function readable(value: string): string {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

export function OrganizationIncidentDiscovery({
  accessToken,
  organizationId,
  canReview,
  onCreateDraftFromIncident,
  onOpenEvent,
}: OrganizationIncidentDiscoveryProps) {
  const [categories, setCategories] = useState<IncidentCategory[]>([]);
  const [boundaries, setBoundaries] = useState<MapBoundaryFeatureCollection>();
  const [searchedBoundary, setSearchedBoundary] =
    useState<MapBoundaryFeatureCollection>();
  const [boundariesLoading, setBoundariesLoading] = useState(true);
  const [boundaryError, setBoundaryError] = useState<string>();
  const [incidents, setIncidents] = useState<OrganizationIncidentSummary[]>([]);
  const [events, setEvents] = useState<CleanupEventMapFeature[]>([]);
  const [viewport, setViewport] = useState<MapViewport>();
  const [selectedId, setSelectedId] = useState<string>();
  const [selectedKind, setSelectedKind] = useState<
    "INCIDENT" | "CLEANUP_EVENT"
  >("INCIDENT");
  const [status, setStatus] =
    useState<(typeof statusOptions)[number]["value"]>("");
  const [categoryId, setCategoryId] = useState("");
  const [timeRange, setTimeRange] =
    useState<(typeof timeOptions)[number]["value"]>("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [nextEventCursor, setNextEventCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string>();
  const [detail, setDetail] = useState<OrganizationIncidentDetail>();
  const [detailLoading, setDetailLoading] = useState(false);
  const [reviewStatus, setReviewStatus] =
    useState<OrganizationIncidentReviewStatus>("VIEWED");
  const [reasonCode, setReasonCode] =
    useState<OrganizationIncidentFalseReasonCode>();
  const [privateNotes, setPrivateNotes] = useState("");
  const [reviewError, setReviewError] = useState<string>();
  const [reviewNotice, setReviewNotice] = useState<string>();
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const selectedEvent = selectedKind === "CLEANUP_EVENT"
    ? events.find((event) => event.properties.id === selectedId) : undefined;
  const selectedIncidentId = selectedKind === "INCIDENT"
    ? selectedId : selectedEvent?.properties.incidentId ?? undefined;
  const [publicEvent, setPublicEvent] = useState<CleanupEventPublicDetail>();
  const [eventError, setEventError] = useState<string>();
  const linkedPublicEvent = selectedKind === "INCIDENT" ? events.find((event) =>
    event.properties.incidentId === selectedId && ["UPCOMING", "ONGOING"].includes(event.properties.status)) : undefined;
  const publicEventId = selectedEvent?.properties.status !== "DRAFT"
    ? selectedEvent?.properties.id ?? linkedPublicEvent?.properties.id : undefined;
  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(async () => {
      if (controller.signal.aborted) return;
      setPublicEvent(undefined);
      setEventError(undefined);
      if (!publicEventId) return;
      try {
        const loaded = await getPublicCleanupEvent(accessToken, publicEventId, controller.signal);
        if (!controller.signal.aborted) setPublicEvent(loaded);
      } catch (error: unknown) {
        if (!controller.signal.aborted) setEventError(describeApiFailure(error, "Unable to load cleanup event details.").message);
      }
    });
    return () => controller.abort();
  }, [accessToken, publicEventId]);
  const activeRequest = useRef<AbortController | undefined>(undefined);
  const detailRequest = useRef<AbortController | undefined>(undefined);
  const selectedIdRef = useRef<string | undefined>(undefined);

  const selectMarker = useCallback(
    (
      id: string | undefined,
      kind: "INCIDENT" | "CLEANUP_EVENT" = "INCIDENT",
    ) => {
      selectedIdRef.current = id;
      setSelectedId(id);
      setSelectedKind(kind);
    },
    [],
  );

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    let active = true;
    void listIncidentCategories(accessToken)
      .then((loaded) => {
        if (active) setCategories(loaded);
      })
      .catch((requestError: unknown) => {
        if (active)
          setError(
            describeApiFailure(
              requestError,
              "Unable to load incident categories.",
            ).message,
          );
      });
    return () => {
      active = false;
    };
  }, [accessToken]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(async () => {
      if (controller.signal.aborted) return;
      setBoundaries(undefined);
      setBoundariesLoading(true);
      setBoundaryError(undefined);
      try {
        const overlay = await listOrganizationServiceAreaBoundaries(
          accessToken,
          organizationId,
          controller.signal,
        );
        if (!controller.signal.aborted) setBoundaries(overlay);
      } catch (requestError: unknown) {
        if (!controller.signal.aborted) {
          setBoundaryError(
            describeApiFailure(
              requestError,
              "Unable to load all organization service areas.",
            ).message,
          );
        }
      } finally {
        if (!controller.signal.aborted) setBoundariesLoading(false);
      }
    });
    return () => controller.abort();
  }, [accessToken, organizationId]);

  useEffect(() => () => activeRequest.current?.abort(), []);

  useEffect(() => {
    detailRequest.current?.abort();
    const timeout = window.setTimeout(() => {
      setDetail(undefined);
      setDetailLoading(false);
      setReviewError(undefined);
      setReviewNotice(undefined);
      setReviewStatus("VIEWED");
      setReasonCode(undefined);
      setPrivateNotes("");

      if (!selectedIncidentId || !canReview) {
        return;
      }

      const controller = new AbortController();
      detailRequest.current = controller;
      setDetailLoading(true);
      void getOrganizationIncidentDetail(
        accessToken,
        organizationId,
        selectedIncidentId,
        controller.signal,
      )
        .then((loaded) => {
          if (controller.signal.aborted) return;
          setDetail(loaded);
          setReviewStatus(loaded.currentReview?.status ?? "VIEWED");
          setReasonCode(
            (loaded.currentReview
              ?.reasonCode as OrganizationIncidentFalseReasonCode | null) ??
              undefined,
          );
          setPrivateNotes(loaded.currentReview?.privateNotes ?? "");
        })
        .catch((requestError: unknown) => {
          if (!controller.signal.aborted) {
            setReviewError(
              describeApiFailure(
                requestError,
                "Unable to load the incident details.",
              ).message,
            );
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setDetailLoading(false);
        });
    }, 0);

    return () => {
      window.clearTimeout(timeout);
      detailRequest.current?.abort();
    };
  }, [accessToken, canReview, organizationId, selectedIncidentId]);

  const loadDiscovery = useCallback(
    async (
      nextViewport: MapViewport,
      filters: DiscoveryFilters,
      options: {
        append?: boolean;
        cursor?: string;
        eventCursor?: string;
        externalSignal?: AbortSignal;
      } = {},
    ) => {
      activeRequest.current?.abort();
      const controller = new AbortController();
      activeRequest.current = controller;
      const abortFromExternal = () => controller.abort();
      options.externalSignal?.addEventListener("abort", abortFromExternal, {
        once: true,
      });
      if (options.externalSignal?.aborted) controller.abort();

      if (options.append) setLoadingMore(true);
      else {
        setLoading(true);
        setNextCursor(null);
      }
      setError(undefined);
      try {
        const incidentRequest =
          options.append && !options.cursor
            ? Promise.resolve({ items: [], nextCursor: null })
            : listOrganizationIncidents(
                accessToken,
                organizationId,
                {
                  ...nextViewport,
                  limit: 100,
                  cursor: options.cursor,
                  status: filters.status || undefined,
                  categoryId: filters.categoryId || undefined,
                  reportedAfter: reportedAfterFor(filters.timeRange),
                },
                controller.signal,
              );
        const eventRequest =
          options.append && !options.eventCursor
            ? Promise.resolve({
                type: "FeatureCollection" as const,
                features: [],
                nextCursor: null,
              })
            : listOrganizationCleanupEventMap(
                accessToken,
                organizationId,
                {
                  ...nextViewport,
                  limit: 100,
                  cursor: options.eventCursor,
                },
                controller.signal,
              );
        const [page, eventPage] = await Promise.all([
          incidentRequest,
          eventRequest,
        ]);
        if (controller.signal.aborted) return;
        setIncidents((current) =>
          options.append ? mergeUnique(current, page.items) : page.items,
        );
        setNextCursor(page.nextCursor);
        setEvents((current) =>
          options.append
            ? [
                ...new Map(
                  [...current, ...eventPage.features].map((item) => [
                    item.properties.id,
                    item,
                  ]),
                ).values(),
              ]
            : eventPage.features,
        );
        setNextEventCursor(eventPage.nextCursor);
        if (!options.append || !selectedIdRef.current) {
          const currentId = selectedIdRef.current;
          if (
            currentId &&
            page.items.some((incident) => incident.id === currentId)
          ) {
            selectMarker(currentId, "INCIDENT");
          } else if (
            currentId &&
            eventPage.features.some(
              (event) => event.properties.id === currentId,
            )
          ) {
            selectMarker(currentId, "CLEANUP_EVENT");
          } else if (page.items[0]) {
            selectMarker(page.items[0].id, "INCIDENT");
          } else if (eventPage.features[0]) {
            selectMarker(eventPage.features[0].properties.id, "CLEANUP_EVENT");
          } else {
            selectMarker(undefined);
          }
        }
      } catch (requestError) {
        if (controller.signal.aborted) return;
        setError(
          describeApiFailure(requestError, "Unable to load covered incidents.")
            .message,
        );
      } finally {
        options.externalSignal?.removeEventListener("abort", abortFromExternal);
        if (activeRequest.current === controller) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [accessToken, organizationId, selectMarker],
  );

  const handleViewportChange = useCallback<MapViewportChangeHandler>(
    (nextViewport, context) => {
      setViewport(nextViewport);
      return loadDiscovery(
        nextViewport,
        { status, categoryId, timeRange },
        { externalSignal: context.signal },
      );
    },
    [categoryId, loadDiscovery, status, timeRange],
  );

  const changeStatus = (
    nextStatus: (typeof statusOptions)[number]["value"],
  ) => {
    setStatus(nextStatus);
    if (viewport)
      void loadDiscovery(viewport, {
        status: nextStatus,
        categoryId,
        timeRange,
      });
  };

  const changeCategory = (nextCategoryId: string) => {
    setCategoryId(nextCategoryId);
    if (viewport)
      void loadDiscovery(viewport, {
        status,
        categoryId: nextCategoryId,
        timeRange,
      });
  };

  const changeTimeRange = (nextTimeRange: DiscoveryFilters["timeRange"]) => {
    setTimeRange(nextTimeRange);
    if (viewport)
      void loadDiscovery(viewport, {
        status,
        categoryId,
        timeRange: nextTimeRange,
      });
  };

  const markers = useMemo<MapMarkerFeature[]>(
    () => [
      ...incidents.filter((incident) => incident.status === "CLEANUP_ORGANIZED" || !events.some((event) =>
        event.properties.isOwned && event.properties.status === "DRAFT" && event.properties.incidentId === incident.id
      )).map(
        (incident) =>
          ({
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [incident.longitude, incident.latitude],
            },
            properties: {
              id: incident.id,
              kind: "INCIDENT",
              isOwned: incident.hasOwnedCleanupEvent ?? events.some((event) =>
                event.properties.incidentId === incident.id && event.properties.isOwned
                && ["DRAFT", "UPCOMING", "ONGOING"].includes(event.properties.status)),
              title: incident.title,
              status: incident.status,
              category: incident.category.name,
              occurredAt: incident.reportedAt,
            },
          }) satisfies MapMarkerFeature,
      ),
      ...events.filter((event) => !incidents.some((incident) =>
        incident.id === event.properties.incidentId && incident.status === "CLEANUP_ORGANIZED"
        && ["UPCOMING", "ONGOING"].includes(event.properties.status))),
    ],
    [events, incidents],
  );
  const displayedBoundaries = useMemo<
    MapBoundaryFeatureCollection | undefined
  >(() => {
    if (!searchedBoundary) return boundaries;
    if (!boundaries) return searchedBoundary;
    return {
      type: "FeatureCollection",
      truncated: boundaries.truncated,
      features: [...boundaries.features, ...searchedBoundary.features],
    };
  }, [boundaries, searchedBoundary]);
  const selected = incidents.find((incident) => incident.id === selectedIncidentId)
    ?? (detail?.id === selectedIncidentId ? detail : undefined);

  const selectedDetail = detail?.id === selectedIncidentId ? detail : undefined;

  const displayedEvent = selectedKind === "INCIDENT"
    ? selectedDetail?.activeCleanupEvent ?? (publicEvent?.id === publicEventId ? publicEvent : undefined)
    : publicEvent?.id === selectedId ? publicEvent : undefined;

  const displayedEventStatus = selectedEvent?.properties.status
    ?? linkedPublicEvent?.properties.status;

  const submitReview = async () => {
    if (!canReview || !selectedIncidentId || selectedDetail?.id !== selectedIncidentId) return;
    if (
      reviewStatus === "VIEWED" &&
      selectedDetail.currentReview &&
      selectedDetail.currentReview.status !== "VIEWED"
    ) {
      setReviewError(
        "A completed VALID or FALSE decision cannot be changed back to VIEWED. Choose VALID or FALSE.",
      );
      return;
    }
    if (reviewStatus === "FALSE" && !reasonCode) {
      setReviewError("Choose a reason before marking this incident false.");
      return;
    }
    if (
      reviewStatus === "FALSE" &&
      reasonCode === "OTHER" &&
      privateNotes.trim().length < 10
    ) {
      setReviewError("Explain an OTHER reason in at least 10 characters.");
      return;
    }

    setReviewSubmitting(true);
    setReviewError(undefined);
    setReviewNotice(undefined);
    try {
      const result = await updateOrganizationIncidentReview(
        accessToken,
        organizationId,
        selectedIncidentId,
        {
          status: reviewStatus,
          ...(reviewStatus === "FALSE" && reasonCode ? { reasonCode } : {}),
          privateNotes: privateNotes.trim() || null,
        },
      );
      setDetail((current) => {
        if (!current || current.id !== selectedIncidentId) return current;
        const wasFalse = current.currentReview?.status === "FALSE";
        const isFalse = result.review.status === "FALSE";
        return {
          ...current,
          currentReview: result.review,
          falseReviewCount: Math.max(
            0,
            current.falseReviewCount +
              (isFalse && !wasFalse ? 1 : wasFalse && !isFalse ? -1 : 0),
          ),
        };
      });
      setIncidents((current) =>
        current.map((incident) =>
          incident.id === selectedIncidentId
            ? {
                ...incident,
                falseReviewCount: Math.max(
                  0,
                  incident.falseReviewCount +
                    (result.review.status === "FALSE" &&
                    incident.currentReviewStatus !== "FALSE"
                      ? 1
                      : result.review.status !== "FALSE" &&
                          incident.currentReviewStatus === "FALSE"
                        ? -1
                        : 0),
                ),
                currentReviewStatus: result.review.status,
              }
            : incident,
        ),
      );
      if (selectedIdRef.current === selectedId) {
        setReviewNotice(
          result.rewardAwarded
            ? "Review saved. The reporter's verified-incident contribution was recorded."
            : result.idempotentReplay
              ? "This review was already saved."
              : "Review saved.",
        );
      }
    } catch (requestError) {
      if (selectedIdRef.current === selectedId) {
        setReviewError(
          describeApiFailure(requestError, "Unable to save this review.")
            .message,
        );
      }
    } finally {
      setReviewSubmitting(false);
    }
  };

  return (
    <section className="organization-incident-discovery">
      <div className="organization-review-toolbar">
        <div>
          <span>Covered incidents</span>
          <strong>
            {loading
              ? "Loading incidents and events in this map view…"
              : nextCursor || nextEventCursor
                ? `Showing the first ${incidents.length + events.length} items in view`
                : `${incidents.length} incidents and ${events.length} cleanup events loaded in this map view`}
          </strong>
          <small>
            {boundariesLoading
              ? "Loading all organization service areas…"
              : `${boundaries?.features.length ?? 0} organization service areas loaded`}
          </small>
        </div>
        <label>
          Status
          <select
            value={status}
            onChange={(event) =>
              changeStatus(
                event.target.value as (typeof statusOptions)[number]["value"],
              )
            }
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Category
          <select
            value={categoryId}
            onChange={(event) => changeCategory(event.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Reported
          <select
            value={timeRange}
            onChange={(event) =>
              changeTimeRange(
                event.target.value as DiscoveryFilters["timeRange"],
              )
            }
          >
            {timeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <p className="organization-review-error" role="alert">
          {error}
        </p>
      )}
      {boundaryError && (
        <p className="organization-review-error" role="alert">
          {boundaryError}
        </p>
      )}
      {boundaries?.truncated && (
        <p className="organization-review-error" role="status">
          The organization has more than 500 service areas, so this overlay is
          incomplete.
        </p>
      )}
      {loading && (
        <p
          className="organization-review-loading"
          role="status"
          aria-live="polite"
        >
          <span aria-hidden="true" />
          Loading incidents and cleanup events for the current map view. Visible
          results may change.
        </p>
      )}

      <AdministrativeAreaMapSearch
        accessToken={accessToken}
        onBoundaryChange={setSearchedBoundary}
      />

      <div className="organization-review-layout">
        <EcoMap
          markers={markers}
          boundaries={displayedBoundaries}
          selectedMarkerId={markers.some((marker) => marker.properties.id === selectedId) ? selectedId : markers.find((marker) => marker.properties.id === selectedIncidentId || marker.properties.incidentId === selectedIncidentId)?.properties.id}
          showListFallback={false}
          showCurrentLocation={false}
          height={560}
          accessibleLabel="Organization incident discovery map"
          onMarkerSelect={(marker) =>
            selectMarker(marker.properties.id, marker.properties.kind)
          }
          onViewportChange={handleViewportChange}
        />

        {incidents.length + events.length === 0 && !loading && (
          <p role="status">No covered incidents in this view</p>
        )}
      </div>

      {(nextCursor || nextEventCursor) && viewport && (
        <button
          className="organization-review-load-more"
          type="button"
          disabled={loadingMore}
          onClick={() =>
            void loadDiscovery(
              viewport,
              { status, categoryId, timeRange },
              {
                append: true,
                cursor: nextCursor ?? undefined,
                eventCursor: nextEventCursor ?? undefined,
              },
            )
          }
        >
          {loadingMore ? "Loading more..." : "Load more activity"}
        </button>
      )}

      {selected && (
        <article className="organization-review-detail">
          <div>
            <span>{selected.category.name}</span>
            <h2>{selected.title}</h2>
            <p>
              {selected.addressText ??
                `${selected.latitude.toFixed(5)}, ${selected.longitude.toFixed(5)}`}
            </p>
          </div>
          <dl>
            <div>
              <dt>Severity</dt>
              <dd>{readable(selected.severity)}</dd>
            </div>
            <div>
              <dt>Your review</dt>
              <dd>
                {selected.currentReviewStatus
                  ? readable(selected.currentReviewStatus)
                  : "Not reviewed"}
              </dd>
            </div>
            <div>
              <dt>Public false count</dt>
              <dd>{selected.falseReviewCount}</dd>
            </div>
          </dl>
          {detailLoading ? (
            <p role="status">Loading incident details...</p>
          ) : null}
          {canReview && reviewError && !selectedDetail ? (
            <p className="organization-review-error" role="alert">
              {reviewError}
            </p>
          ) : null}
          {!canReview ? (
            <p className="organization-review-no-evidence">
              Incident review actions require Organization Admin access.
            </p>
          ) : selectedDetail ? (
            <div className="organization-review-form">
              <div className="organization-review-form-heading">
                <div>
                  <span>Organization review</span>
                  <h3>{selectedDetail.accessSource.replaceAll("_", " ")}</h3>
                </div>
                <small>
                  {selectedDetail.photos.length} evidence photo
                  {selectedDetail.photos.length === 1 ? "" : "s"}
                </small>
              </div>
              <p className="organization-review-description">
                {selectedDetail.description}
              </p>
              {selectedDetail.photos.length > 0 ? (
                <div
                  className="organization-review-evidence"
                  aria-label="Incident evidence"
                >
                  {selectedDetail.photos.map((photo, index) => (
                    <figure key={photo.id}>
                      <img
                        src={photo.url}
                        alt={photo.caption || `Incident evidence ${index + 1}`}
                        loading="lazy"
                      />
                      {photo.caption ? (
                        <figcaption>{photo.caption}</figcaption>
                      ) : null}
                    </figure>
                  ))}
                </div>
              ) : (
                <p className="organization-review-no-evidence">
                  No photo evidence was submitted.
                </p>
              )}
              <label>
                Review status
                <select
                  value={reviewStatus}
                  disabled={reviewSubmitting}
                  onChange={(event) => {
                    const next = event.target
                      .value as OrganizationIncidentReviewStatus;
                    setReviewStatus(next);
                    if (next !== "FALSE") setReasonCode(undefined);
                  }}
                >
                  <option
                    value="VIEWED"
                    disabled={Boolean(
                      selectedDetail.currentReview &&
                        selectedDetail.currentReview.status !== "VIEWED",
                    )}
                  >
                    Viewed
                    {selectedDetail.currentReview &&
                    selectedDetail.currentReview.status !== "VIEWED"
                      ? " (initial state only)"
                      : ""}
                  </option>
                  <option value="VALID">Valid</option>
                  <option value="FALSE">False</option>
                </select>
              </label>
              {reviewStatus === "FALSE" ? (
                <>
                  <label>
                    False reason
                    <select
                      value={reasonCode ?? ""}
                      disabled={reviewSubmitting}
                      onChange={(event) =>
                        setReasonCode(
                          event.target
                            .value as OrganizationIncidentFalseReasonCode,
                        )
                      }
                    >
                      <option value="">Choose a reason</option>
                      {reviewReasonOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Private notes
                    <textarea
                      value={privateNotes}
                      disabled={reviewSubmitting}
                      maxLength={2000}
                      onChange={(event) => setPrivateNotes(event.target.value)}
                      placeholder="Visible only to authorized organization users."
                      rows={4}
                    />
                  </label>
                </>
              ) : null}
              {reviewError ? (
                <p className="organization-review-error" role="alert">
                  {reviewError}
                </p>
              ) : null}
              {reviewNotice ? (
                <p className="organization-review-success" role="status">
                  {reviewNotice}
                </p>
              ) : null}
              <button
                type="button"
                className="organization-review-submit"
                disabled={reviewSubmitting || !selectedDetail}
                onClick={() => void submitReview()}
              >
                {reviewSubmitting ? "Saving review..." : "Save review"}
              </button>
            </div>
          ) : null}
          {onCreateDraftFromIncident && selected.status !== "CLEANUP_ORGANIZED" && (
            <button
              className="organization-review-action"
              type="button"
              onClick={() => onCreateDraftFromIncident(selected.id)}
            >
              Create cleanup-event draft
            </button>
          )}
        </article>
      )}
      {(displayedEvent || selectedEvent) && (
        <article className="organization-review-detail" aria-label="Cleanup event details">
          <div>
            <span>Cleanup event</span>
            <h2>{displayedEvent?.title ?? selectedEvent?.properties.title}</h2>
            <p>{displayedEvent?.organization.name ?? selectedEvent?.properties.organizationName}</p>
          </div>
          {displayedEventStatus && <p>{readable(displayedEventStatus)}</p>}
          {displayedEvent && <>
            <p>{displayedEvent.description}</p>
            {displayedEvent.startsAt && <p>{new Date(displayedEvent.startsAt).toLocaleString()}</p>}
            {displayedEvent.eventAddress && <p>{displayedEvent.eventAddress}</p>}
            {displayedEvent.meetingAddress && <p>Meeting point: {displayedEvent.meetingAddress}</p>}
            {displayedEvent.publicInstructions && <p>{displayedEvent.publicInstructions}</p>}
          </>}
          {eventError && <p role="alert">{eventError}</p>}
          {onOpenEvent && selectedEvent?.properties.isOwned && (
            <button className="organization-review-action" type="button"
              onClick={() => onOpenEvent(selectedEvent.properties.id, selectedEvent.properties.status)}>
              Open selected event
            </button>
          )}
        </article>
      )}
    </section>
  );
}
