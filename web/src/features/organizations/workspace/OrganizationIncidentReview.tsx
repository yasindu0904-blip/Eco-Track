import { useCallback, useEffect, useMemo, useState } from "react";

import { describeApiFailure } from "../../../api/apiError";
import {
  EcoMap,
  type MapBoundaryFeatureCollection,
  type MapMarkerFeature,
  type MapViewport,
  type MapViewportChangeHandler,
} from "../../maps";
import {
  listOrganizationIncidents,
  listOrganizationServiceAreaBoundaries,
} from "./organizationIncidentReview.api";
import type { OrganizationIncidentSummary } from "./organizationIncidentReview.types";

interface OrganizationIncidentReviewProps {
  accessToken: string;
  organizationId: string;
}

const statusOptions = [
  { value: "", label: "All current" },
  { value: "ACTIVE", label: "Active" },
  { value: "CLEANUP_ORGANIZED", label: "Cleanup organized" },
  { value: "RESOLVED", label: "Resolved" },
] as const;

function readable(value: string): string {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

export function OrganizationIncidentReview({
  accessToken,
  organizationId,
}: OrganizationIncidentReviewProps) {
  const [boundaries, setBoundaries] =
    useState<MapBoundaryFeatureCollection>();
  const [allIncidents, setAllIncidents] = useState<OrganizationIncidentSummary[]>([]);
  const [viewport, setViewport] = useState<MapViewport>();
  const [selectedId, setSelectedId] = useState<string>();
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    void listOrganizationServiceAreaBoundaries(accessToken, organizationId)
      .then(setBoundaries)
      .catch((requestError: unknown) => {
        setError(
          describeApiFailure(
            requestError,
            "Unable to load organization service areas.",
          ).message,
        );
      });
  }, [accessToken, organizationId]);

  useEffect(() => {
    const controller = new AbortController();

    void listOrganizationIncidents(
      accessToken,
      organizationId,
      controller.signal,
    )
      .then((page) => {
        if (controller.signal.aborted) return;
        setAllIncidents(page.items);
        setSelectedId(page.items[0]?.id);
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          describeApiFailure(
            requestError,
            "Unable to load covered incidents.",
          ).message,
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [accessToken, organizationId]);

  const incidents = useMemo(
    () =>
      allIncidents.filter((incident) => {
        if (status && incident.status !== status) return false;
        if (!viewport) return true;

        return (
          incident.longitude >= viewport.west &&
          incident.longitude <= viewport.east &&
          incident.latitude >= viewport.south &&
          incident.latitude <= viewport.north
        );
      }),
    [allIncidents, status, viewport],
  );

  const handleViewportChange = useCallback<MapViewportChangeHandler>(
    (nextViewport) => {
      setViewport(nextViewport);
      const nextVisible = allIncidents.filter(
        (incident) =>
          (!status || incident.status === status) &&
          incident.longitude >= nextViewport.west &&
          incident.longitude <= nextViewport.east &&
          incident.latitude >= nextViewport.south &&
          incident.latitude <= nextViewport.north,
      );
      setSelectedId((current) =>
        nextVisible.some((incident) => incident.id === current)
          ? current
          : nextVisible[0]?.id,
      );
    },
    [allIncidents, status],
  );

  const changeStatus = (nextStatus: string) => {
    setStatus(nextStatus);
    const nextVisible = allIncidents.filter((incident) => {
      if (nextStatus && incident.status !== nextStatus) return false;
      if (!viewport) return true;
      return (
        incident.longitude >= viewport.west &&
        incident.longitude <= viewport.east &&
        incident.latitude >= viewport.south &&
        incident.latitude <= viewport.north
      );
    });
    setSelectedId((current) =>
      nextVisible.some((incident) => incident.id === current)
        ? current
        : nextVisible[0]?.id,
    );
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

  return (
    <section className="organization-incident-review">
      <div className="organization-review-toolbar">
        <div>
          <span>Covered incidents</span>
          <strong>
            {loading
              ? "Loading all covered incidents"
              : `${incidents.length} of ${allIncidents.length} in view`}
          </strong>
        </div>
        <label>
          Status
          <select value={status} onChange={(event) => changeStatus(event.target.value)}>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="organization-review-error" role="alert">{error}</p>}

      <div className="organization-review-layout">
        <EcoMap
          markers={markers}
          boundaries={boundaries}
          selectedMarkerId={selectedId}
          showListFallback={false}
          height={560}
          accessibleLabel="Organization incident review map"
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
        </article>
      )}
    </section>
  );
}
