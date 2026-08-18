import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { describeApiFailure } from "../../../api/apiError";
import { listIncidentCategories } from "../../incidents/incident.api";
import type { IncidentCategory } from "../../incidents/incident.types";
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
}: OrganizationIncidentDiscoveryProps) {
  const [categories, setCategories] = useState<IncidentCategory[]>([]);
  const [boundaries, setBoundaries] =
    useState<MapBoundaryFeatureCollection>();
  const [incidents, setIncidents] = useState<OrganizationIncidentSummary[]>([]);
  const [viewport, setViewport] = useState<MapViewport>();
  const [selectedId, setSelectedId] = useState<string>();
  const [status, setStatus] =
    useState<(typeof statusOptions)[number]["value"]>("");
  const [categoryId, setCategoryId] = useState("");
  const [timeRange, setTimeRange] =
    useState<(typeof timeOptions)[number]["value"]>("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string>();
  const [detail, setDetail] = useState<OrganizationIncidentDetail>();
  const [reviewStatus, setReviewStatus] = useState<OrganizationIncidentReviewStatus>("VIEWED");
  const [reasonCode, setReasonCode] = useState<OrganizationIncidentFalseReasonCode>();
  const [privateNotes, setPrivateNotes] = useState("");
  const [reviewError, setReviewError] = useState<string>();
  const [reviewNotice, setReviewNotice] = useState<string>();
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const activeRequest = useRef<AbortController | undefined>(undefined);
  const detailRequest = useRef<AbortController | undefined>(undefined);

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
    if (!selectedId) {
      return;
    }

    const controller = new AbortController();
    detailRequest.current = controller;
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
      });

    return () => controller.abort();
  }, [accessToken, organizationId, selectedId]);

  const loadDiscovery = useCallback(
    async (
      nextViewport: MapViewport,
      filters: DiscoveryFilters,
      options: {
        append?: boolean;
        cursor?: string;
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
        const page = await listOrganizationIncidents(
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
        if (controller.signal.aborted) return;
        setIncidents((current) =>
          options.append ? mergeUnique(current, page.items) : page.items,
        );
        setNextCursor(page.nextCursor);
        setSelectedId((current) =>
          options.append && current
            ? current
            :
          page.items.some((incident) => incident.id === current)
            ? current
            : page.items[0]?.id,
        );

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
    [accessToken, organizationId],
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
      incidents.map((incident) => ({
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
  const selected = incidents.find((incident) => incident.id === selectedId);
  const selectedDetail = detail?.id === selectedId ? detail : undefined;
  const detailLoading = Boolean(selectedId && !selectedDetail && !reviewError);

  const submitReview = async () => {
    if (!selectedId) return;
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
      setDetail((current) => current ? { ...current, currentReview: result.review } : current);
      setIncidents((current) => current.map((incident) =>
        incident.id === selectedId
          ? { ...incident, currentReviewStatus: result.review.status }
          : incident,
      ));
      setReviewNotice(
        result.rewardAwarded
          ? "Review saved. Your verified incident contribution was recorded."
          : result.idempotentReplay
            ? "This review was already saved."
            : "Review saved.",
      );
    } catch (requestError) {
      setReviewError(describeApiFailure(requestError, "Unable to save this review.").message);
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
              ? "Loading incidents in this view"
              : nextCursor
                ? `Showing the first ${incidents.length} incidents in view`
                : `${incidents.length} incidents in view`}
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
          height={560}
          accessibleLabel="Organization incident discovery map"
          onMarkerSelect={(marker) => setSelectedId(marker.properties.id)}
          onViewportChange={handleViewportChange}
        />

        <aside className="organization-review-list" aria-label="Covered incidents">
          {incidents.length === 0 && !loading ? (
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
                onClick={() => setSelectedId(incident.id)}
              >
                <span>{incident.category.name}</span>
                <strong>{incident.title}</strong>
                <small>
                  {readable(incident.severity)} severity · {readable(incident.status)}
                </small>
              </button>
            ))
          )}
        </aside>
      </div>

      {nextCursor && viewport && (
        <button
          className="organization-review-load-more"
          type="button"
          disabled={loadingMore}
          onClick={() =>
            void loadDiscovery(
              viewport,
              { status, categoryId, timeRange },
              { append: true, cursor: nextCursor },
            )
          }
        >
          {loadingMore ? "Loading more..." : "Load more incidents"}
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
          {selectedDetail ? (
            <div className="organization-review-form">
              <div className="organization-review-form-heading">
                <div>
                  <span>Organization review</span>
                  <h3>{selectedDetail.accessSource.replaceAll("_", " ")}</h3>
                </div>
                <small>{selectedDetail.photos.length} evidence photo{selectedDetail.photos.length === 1 ? "" : "s"}</small>
              </div>
              <p className="organization-review-description">{selectedDetail.description}</p>
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
                      maxLength={1000}
                      onChange={(event) => setPrivateNotes(event.target.value)}
                      placeholder="Visible only to authorized organization users."
                      rows={4}
                    />
                  </label>
                </>
              ) : null}
              {reviewError ? <p className="organization-review-error" role="alert">{reviewError}</p> : null}
              {reviewNotice ? <p className="organization-review-success" role="status">{reviewNotice}</p> : null}
              <button type="button" className="organization-review-submit" disabled={reviewSubmitting} onClick={() => void submitReview()}>
                {reviewSubmitting ? "Saving review..." : "Save review"}
              </button>
            </div>
          ) : null}
        </article>
      )}
    </section>
  );
}
