import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { describeApiFailure } from "../../../api/apiError";
import { listIncidentCategories } from "../../incidents/incident.api";
import type { IncidentCategory } from "../../incidents/incident.types";
import { listOrganizationCleanupEventMap } from "../../cleanup-events/cleanupEvent.api";
import type { CleanupEventMapFeature } from "../../cleanup-events/cleanupEvent.types";
import {
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
  { value: "RESOLVED", label: "Resolved" },
] as const;

const timeOptions = [
  { value: "", label: "Any time", milliseconds: 0 },
  { value: "24h", label: "Last 24 hours", milliseconds: 24 * 60 * 60 * 1000 },
  { value: "7d", label: "Last 7 days", milliseconds: 7 * 24 * 60 * 60 * 1000 },
  { value: "30d", label: "Last 30 days", milliseconds: 30 * 24 * 60 * 60 * 1000 },
] as const;

const reviewReasonOptions: Array<{
  value: OrganizationIncidentFalseReasonCode;
  label: string;
}> = [
  { value: "INSUFFICIENT_EVIDENCE", label: "Insufficient evidence" },
  { value: "LOCATION_INCORRECT", label: "Location is incorrect" },
  { value: "DUPLICATE_REPORT", label: "Duplicate report" },
  { value: "NOT_AN_ENVIRONMENTAL_INCIDENT", label: "Not an environmental incident" },
  { value: "OUTSIDE_SERVICE_SCOPE", label: "Outside service scope" },
  { value: "OTHER", label: "Other" },
];

type DiscoveryFilters = {
  status: (typeof statusOptions)[number]["value"];
  categoryId: string;
  timeRange: (typeof timeOptions)[number]["value"];
};

function reportedAfterFor(value: DiscoveryFilters["timeRange"]): string | undefined {
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
  const [boundaries, setBoundaries] =
    useState<MapBoundaryFeatureCollection>();
  const [incidents, setIncidents] = useState<OrganizationIncidentSummary[]>([]);
  const [events, setEvents] = useState<CleanupEventMapFeature[]>([]);
  const [viewport, setViewport] = useState<MapViewport>();
  const [selectedId, setSelectedId] = useState<string>();
  const [selectedKind, setSelectedKind] = useState<"INCIDENT" | "CLEANUP_EVENT">("INCIDENT");
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
  const [reviewStatus, setReviewStatus] = useState<OrganizationIncidentReviewStatus>("VIEWED");
  const [reasonCode, setReasonCode] = useState<OrganizationIncidentFalseReasonCode>();
  const [privateNotes, setPrivateNotes] = useState("");
  const [reviewError, setReviewError] = useState<string>();
  const [reviewNotice, setReviewNotice] = useState<string>();
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const activeRequest = useRef<AbortController | undefined>(undefined);
  const detailRequest = useRef<AbortController | undefined>(undefined);
  const selectedIdRef = useRef<string | undefined>(undefined);

  const selectMarker = useCallback((id: string | undefined, kind: "INCIDENT" | "CLEANUP_EVENT" = "INCIDENT") => {
    selectedIdRef.current = id;
    setSelectedId(id);
    setSelectedKind(kind);
  }, []);

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
        if (active) setError(
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

      if (!selectedId || selectedKind !== "INCIDENT" || !canReview) {
        return;
      }

      const controller = new AbortController();
      detailRequest.current = controller;
      setDetailLoading(true);
      void getOrganizationIncidentDetail(
        accessToken,
        organizationId,
        selectedId,
        controller.signal,
      )
        .then((loaded) => {
          if (controller.signal.aborted) return;
          setDetail(loaded);
          setReviewStatus(loaded.currentReview?.status ?? "VIEWED");
          setReasonCode(
            (loaded.currentReview?.reasonCode as OrganizationIncidentFalseReasonCode | null) ?? undefined,
          );
          setPrivateNotes(loaded.currentReview?.privateNotes ?? "");
        })
        .catch((requestError: unknown) => {
          if (!controller.signal.aborted) {
            setReviewError(
              describeApiFailure(requestError, "Unable to load the incident details.").message,
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
  }, [accessToken, canReview, organizationId, selectedId, selectedKind]);

  const loadDiscovery = useCallback(
    async (
      nextViewport: MapViewport,
      filters: DiscoveryFilters,
      options: {
        append?: boolean;
        cursor?: string;
        eventCursor?: string;
        includeBoundaries?: boolean;
        externalSignal?: AbortSignal;
      } = {},
    ) => {
      activeRequest.current?.abort();
      const controller = new AbortController();
      activeRequest.current = controller;
      const abortFromExternal = () => controller.abort();
      options.externalSignal?.addEventListener("abort", abortFromExternal, { once: true });
      if (options.externalSignal?.aborted) controller.abort();

      if (options.append) setLoadingMore(true);
      else {
        setLoading(true);
        setNextCursor(null);
      }
      setError(undefined);
      try {
        const incidentRequest = options.append && !options.cursor
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
        const eventRequest = options.append && !options.eventCursor
          ? Promise.resolve({ type: "FeatureCollection" as const, features: [], nextCursor: null })
          : listOrganizationCleanupEventMap(accessToken, organizationId, {
              ...nextViewport, limit: 100, cursor: options.eventCursor,
            }, controller.signal);
        const [page, eventPage] = await Promise.all([incidentRequest, eventRequest]);
        if (controller.signal.aborted) return;
        setIncidents((current) =>
          options.append ? mergeUnique(current, page.items) : page.items,
        );
        setNextCursor(page.nextCursor);
        setEvents((current) => options.append
          ? [...new Map([...current, ...eventPage.features].map((item) => [item.properties.id, item])).values()]
          : eventPage.features);
        setNextEventCursor(eventPage.nextCursor);
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

        if (options.includeBoundaries) {
          const overlay = await listOrganizationServiceAreaBoundaries(
            accessToken,
            organizationId,
            { ...nextViewport, limit: 100 },
            controller.signal,
          );
          if (!controller.signal.aborted) setBoundaries(overlay);
        }
      } catch (requestError) {
        if (controller.signal.aborted) return;
        setError(
          describeApiFailure(
            requestError,
            "Unable to load covered incidents.",
          ).message,
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
        { includeBoundaries: true, externalSignal: context.signal },
      );
    },
    [categoryId, loadDiscovery, status, timeRange],
  );

  const changeStatus = (nextStatus: (typeof statusOptions)[number]["value"]) => {
    setStatus(nextStatus);
    if (viewport) void loadDiscovery(viewport, { status: nextStatus, categoryId, timeRange });
  };

  const changeCategory = (nextCategoryId: string) => {
    setCategoryId(nextCategoryId);
    if (viewport) void loadDiscovery(viewport, { status, categoryId: nextCategoryId, timeRange });
  };

  const changeTimeRange = (nextTimeRange: DiscoveryFilters["timeRange"]) => {
    setTimeRange(nextTimeRange);
    if (viewport) void loadDiscovery(viewport, { status, categoryId, timeRange: nextTimeRange });
  };

  const markers = useMemo<MapMarkerFeature[]>(
    () =>
      [...incidents.map((incident) => ({
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
      } satisfies MapMarkerFeature)), ...events],
    [events, incidents],
  );
  const selected = incidents.find((incident) => incident.id === selectedId);
  const selectedEvent = events.find((event) => event.properties.id === selectedId);
  const selectedDetail = detail?.id === selectedId ? detail : undefined;

  const submitReview = async () => {
    if (!canReview || !selectedId || selectedDetail?.id !== selectedId) return;
    if (reviewStatus === "FALSE" && !reasonCode) {
      setReviewError("Choose a reason before marking this incident false.");
      return;
    }
    if (reviewStatus === "FALSE" && reasonCode === "OTHER" && privateNotes.trim().length < 10) {
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
        selectedId,
        {
          status: reviewStatus,
          ...(reviewStatus === "FALSE" && reasonCode ? { reasonCode } : {}),
          privateNotes: privateNotes.trim() || null,
        },
      );
      setDetail((current) => {
        if (!current || current.id !== selectedId) return current;
        const wasFalse = current.currentReview?.status === "FALSE";
        const isFalse = result.review.status === "FALSE";
        return {
          ...current,
          currentReview: result.review,
          falseReviewCount: Math.max(
            0,
            current.falseReviewCount + (isFalse && !wasFalse ? 1 : wasFalse && !isFalse ? -1 : 0),
          ),
        };
      });
      setIncidents((current) => current.map((incident) =>
        incident.id === selectedId
          ? {
              ...incident,
              falseReviewCount: Math.max(
                0,
                incident.falseReviewCount +
                  (result.review.status === "FALSE" && incident.currentReviewStatus !== "FALSE"
                    ? 1
                    : result.review.status !== "FALSE" && incident.currentReviewStatus === "FALSE"
                      ? -1
                      : 0),
              ),
              currentReviewStatus: result.review.status,
            }
          : incident,
      ));
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
          describeApiFailure(requestError, "Unable to save this review.").message,
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
              ? "Loading activity in this view"
              : (nextCursor || nextEventCursor)
                ? `Showing the first ${incidents.length + events.length} items in view`
                : `${incidents.length} incidents and ${events.length} owned events in view`}
          </strong>
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
              changeTimeRange(event.target.value as DiscoveryFilters["timeRange"])
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

      {error && <p className="organization-review-error" role="alert">{error}</p>}
      {boundaries?.truncated && (
        <p className="organization-review-error" role="status">
          The service-area overlay reached its 100-feature display limit. Zoom in to view the remaining boundaries.
        </p>
      )}

      <div className="organization-review-layout">
        <EcoMap
          markers={markers}
          boundaries={boundaries}
          selectedMarkerId={selectedId}
          showListFallback={false}
          showCurrentLocation={false}
          height={560}
          accessibleLabel="Organization incident discovery map"
          onMarkerSelect={(marker) => selectMarker(marker.properties.id, marker.properties.kind)}
          onViewportChange={handleViewportChange}
        />

        <aside className="organization-review-list" aria-label="Covered incidents">
          {incidents.length + events.length === 0 && !loading ? (
            <div className="organization-review-empty">
              <strong>No covered incidents in this view</strong>
              <p>Use the focus control on the map to return to your service areas.</p>
            </div>
          ) : (
            incidents.map((incident) => (
              <button
                key={incident.id}
                type="button"
                className={incident.id === selectedId ? "is-selected" : undefined}
                onClick={() => selectMarker(incident.id, "INCIDENT")}
              >
                <span>{incident.category.name}</span>
                <strong>{incident.title}</strong>
                <small>
                  {readable(incident.severity)} severity · {readable(incident.status)}
                </small>
              </button>
            ))
          )}
          {events.map((event) => (
            <button key={`event-${event.properties.id}`} type="button"
              className={event.properties.id === selectedId ? "is-selected" : undefined}
              onClick={() => selectMarker(event.properties.id, "CLEANUP_EVENT")}>
              <span>Owned cleanup event</span><strong>{event.properties.title}</strong>
              <small>{readable(event.properties.status)}</small>
            </button>
          ))}
        </aside>
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
              { append: true, cursor: nextCursor ?? undefined, eventCursor: nextEventCursor ?? undefined },
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
            <p>{selected.addressText ?? `${selected.latitude.toFixed(5)}, ${selected.longitude.toFixed(5)}`}</p>
          </div>
          <dl>
            <div><dt>Severity</dt><dd>{readable(selected.severity)}</dd></div>
            <div><dt>Your review</dt><dd>{selected.currentReviewStatus ? readable(selected.currentReviewStatus) : "Not reviewed"}</dd></div>
            <div><dt>Public false count</dt><dd>{selected.falseReviewCount}</dd></div>
          </dl>
          {detailLoading ? <p role="status">Loading incident details...</p> : null}
          {canReview && reviewError && !selectedDetail ? (
            <p className="organization-review-error" role="alert">{reviewError}</p>
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
                <small>{selectedDetail.photos.length} evidence photo{selectedDetail.photos.length === 1 ? "" : "s"}</small>
              </div>
              <p className="organization-review-description">{selectedDetail.description}</p>
              {selectedDetail.photos.length > 0 ? (
                <div className="organization-review-evidence" aria-label="Incident evidence">
                  {selectedDetail.photos.map((photo, index) => (
                    <figure key={photo.id}>
                      <img
                        src={photo.url}
                        alt={photo.caption || `Incident evidence ${index + 1}`}
                        loading="lazy"
                      />
                      {photo.caption ? <figcaption>{photo.caption}</figcaption> : null}
                    </figure>
                  ))}
                </div>
              ) : (
                <p className="organization-review-no-evidence">No photo evidence was submitted.</p>
              )}
              <label>
                Review status
                <select
                  value={reviewStatus}
                  disabled={reviewSubmitting}
                  onChange={(event) => {
                    const next = event.target.value as OrganizationIncidentReviewStatus;
                    setReviewStatus(next);
                    if (next !== "FALSE") setReasonCode(undefined);
                  }}
                >
                  <option value="VIEWED">Viewed</option>
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
                      onChange={(event) => setReasonCode(event.target.value as OrganizationIncidentFalseReasonCode)}
                    >
                      <option value="">Choose a reason</option>
                      {reviewReasonOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
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
              {reviewError ? <p className="organization-review-error" role="alert">{reviewError}</p> : null}
              {reviewNotice ? <p className="organization-review-success" role="status">{reviewNotice}</p> : null}
              <button type="button" className="organization-review-submit" disabled={reviewSubmitting || !selectedDetail} onClick={() => void submitReview()}>
                {reviewSubmitting ? "Saving review..." : "Save review"}
              </button>
            </div>
           ) : null}
          {onCreateDraftFromIncident && (
            <button
              type="button"
              onClick={() => onCreateDraftFromIncident(selected.id)}
            >
              Create cleanup-event draft
            </button>
          )}
        </article>
      )}
      {selectedKind === "CLEANUP_EVENT" && selectedEvent && (
        <article className="organization-review-detail">
          <div><span>Owned cleanup event</span><h2>{selectedEvent.properties.title}</h2>
            <p>{selectedEvent.properties.organizationName}</p></div>
          <dl><div><dt>Status</dt><dd>{readable(selectedEvent.properties.status)}</dd></div>
            <div><dt>Linked incident</dt><dd>{selectedEvent.properties.incidentId ?? "None"}</dd></div></dl>
          {onOpenEvent && <button type="button" onClick={() => onOpenEvent(selectedEvent.properties.id, selectedEvent.properties.status)}>Open selected event</button>}
        </article>
      )}
    </section>
  );
}
