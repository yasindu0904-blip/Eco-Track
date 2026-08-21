// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { getPublicCleanupEvent, listNearbyCleanupEventMap, listPublicCleanupEventMap } from "./cleanup-events/cleanupEvent.api";
import { CitizenIncidentDiscovery } from "./incidents/CitizenIncidentDiscovery";
import { getPublicIncident, listIncidentCategories, listNearbyPublicIncidents, listPublicIncidents } from "./incidents/incident.api";
import type { MapMarkerFeature, MapViewport } from "./maps";
import { OrganizationIncidentDiscovery } from "./organizations/workspace/OrganizationIncidentDiscovery";
import {
  getOrganizationIncidentDetail,
  listOrganizationIncidents,
  listOrganizationServiceAreaBoundaries,
} from "./organizations/workspace/organizationIncidentDiscovery.api";
import { SuperAdminMapOverview } from "./super-admin/SuperAdminMapOverview";
import { listOrganizationCleanupEventMap } from "./cleanup-events/cleanupEvent.api";

const viewport: MapViewport = {
  west: 79.8,
  south: 6.8,
  east: 80,
  north: 7,
  zoom: 12,
};

vi.mock("./maps", async () => {
  const actual = await vi.importActual<typeof import("./maps")>("./maps");
  return {
    ...actual,
    EcoMap: (props: ComponentProps<typeof actual.EcoMap>) => (
      <div aria-label={props.accessibleLabel}>
        <button
          type="button"
          onClick={() => void props.onViewportChange?.(viewport, {
            signal: new AbortController().signal,
            requestId: 1,
          })}
        >
          Load viewport
        </button>
        <output data-testid="selected-marker">{props.selectedMarkerId ?? "none"}</output>
        <output data-testid="selected-location">
          {props.selectedLocation ? `${props.selectedLocation.latitude},${props.selectedLocation.longitude}` : "none"}
        </output>
        <output data-testid="search-radius">{props.searchRadiusMeters ?? "none"}</output>
        <output data-testid="marker-ids">
          {(props.markers ?? []).map((marker) => marker.properties.id).join(",") || "none"}
        </output>
        <output data-testid="boundary-ids">
          {(props.boundaries?.features ?? []).map((boundary) => boundary.properties.id).join(",") || "none"}
        </output>
        {(props.markers ?? []).map((marker: MapMarkerFeature) => (
          <div key={`${marker.properties.kind}-${marker.properties.id}`}>
            <button
              type="button"
              onClick={() => props.onMarkerSelect?.(marker)}
            >
              Map marker {marker.properties.title}
            </button>
            {props.markerActionLabel?.(marker) && props.onMarkerAction ? (
              <button
                type="button"
                aria-label={`${props.markerActionLabel(marker)} from map`}
                onClick={() => props.onMarkerAction?.(marker)}
              >
                {props.markerActionLabel(marker)}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    ),
  };
});

vi.mock("./incidents/incident.api", () => ({
  getPublicIncident: vi.fn(),
  listIncidentCategories: vi.fn(),
  listNearbyPublicIncidents: vi.fn(),
  listPublicIncidents: vi.fn(),
}));

vi.mock("./cleanup-events/cleanupEvent.api", () => ({
  getPublicCleanupEvent: vi.fn(),
  listNearbyCleanupEventMap: vi.fn(),
  listOrganizationCleanupEventMap: vi.fn(),
  listPublicCleanupEventMap: vi.fn(),
}));

vi.mock("./organizations/workspace/organizationIncidentDiscovery.api", () => ({
  getOrganizationIncidentDetail: vi.fn(),
  listOrganizationIncidents: vi.fn(),
  listOrganizationServiceAreaBoundaries: vi.fn(),
  updateOrganizationIncidentReview: vi.fn(),
}));

const emptyIncidentPage = { items: [], nextCursor: null };
const emptyEventPage = { type: "FeatureCollection" as const, features: [], nextCursor: null };
const emptyBoundaries = {
  type: "FeatureCollection" as const,
  features: [],
  truncated: false,
};

beforeEach(() => {
  vi.mocked(listIncidentCategories).mockResolvedValue([]);
  vi.mocked(listPublicIncidents).mockResolvedValue(emptyIncidentPage);
  vi.mocked(listNearbyPublicIncidents).mockResolvedValue(emptyIncidentPage);
  vi.mocked(listPublicCleanupEventMap).mockResolvedValue(emptyEventPage);
  vi.mocked(listNearbyCleanupEventMap).mockResolvedValue(emptyEventPage);
  vi.mocked(listOrganizationIncidents).mockResolvedValue(emptyIncidentPage);
  vi.mocked(listOrganizationCleanupEventMap).mockResolvedValue(emptyEventPage);
  vi.mocked(listOrganizationServiceAreaBoundaries).mockResolvedValue(emptyBoundaries);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  Reflect.deleteProperty(window.navigator, "geolocation");
});

describe("role-specific map scenarios", () => {
  test("citizen cleanup-event map recovers from a nearby-search API error without requesting incidents", async () => {
    vi.mocked(listNearbyCleanupEventMap)
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValue(emptyEventPage);
    const getCurrentPosition = vi.fn((success: PositionCallback) => success({
      coords: {
        latitude: 6.9271,
        longitude: 79.8612,
        accuracy: 10,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
        toJSON: () => ({}),
      },
      timestamp: 1,
      toJSON: () => ({}),
    }));
    Object.defineProperty(window.navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition },
    });

    render(<CitizenIncidentDiscovery accessToken="token" />);
    expect(listNearbyCleanupEventMap).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Use my location" }));

    expect((await screen.findByRole("alert")).textContent).toContain("network unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("No published cleanup events found")).toBeTruthy();
    expect(listPublicIncidents).not.toHaveBeenCalled();
    expect(listIncidentCategories).not.toHaveBeenCalled();
  });

  test("citizen map does not request events before location permission succeeds", async () => {
    const getCurrentPosition = vi.fn(
      (_success: PositionCallback, error: PositionErrorCallback) =>
        error({ code: 1, message: "denied", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }),
    );
    Object.defineProperty(window.navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition },
    });

    render(<CitizenIncidentDiscovery accessToken="token" />);
    expect(screen.getByTestId("selected-location").textContent).toBe("none");
    expect(screen.getByText("Use your location to begin")).toBeTruthy();
    expect(listNearbyCleanupEventMap).not.toHaveBeenCalled();
    expect(listPublicCleanupEventMap).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Use my location" }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Location permission was denied or your current position is unavailable.",
    );
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);

    expect(screen.getByText("Use your location to begin")).toBeTruthy();
    expect(listNearbyCleanupEventMap).not.toHaveBeenCalled();
    expect(listPublicCleanupEventMap).not.toHaveBeenCalled();
    expect(listPublicIncidents).not.toHaveBeenCalled();
  });

  test("citizen location search defaults to two kilometres and loads additional pages only on request", async () => {
    vi.mocked(listNearbyCleanupEventMap)
      .mockResolvedValueOnce({ ...emptyEventPage, nextCursor: "event-page-2" })
      .mockResolvedValueOnce(emptyEventPage);
    const getCurrentPosition = vi.fn((success: PositionCallback) => success({
      coords: {
        latitude: 6.9271,
        longitude: 79.8612,
        accuracy: 10,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
        toJSON: () => ({}),
      },
      timestamp: 1,
      toJSON: () => ({}),
    }));
    Object.defineProperty(window.navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition },
    });

    render(<CitizenIncidentDiscovery accessToken="token" />);
    expect(screen.getByTestId("selected-location").textContent).toBe("none");
    fireEvent.click(screen.getByRole("button", { name: "Use my location" }));

    await waitFor(() => expect(listNearbyCleanupEventMap).toHaveBeenCalledWith(
      "token",
      expect.objectContaining({ latitude: 6.9271, longitude: 79.8612, radiusMeters: 2_000, limit: 50 }),
      expect.any(AbortSignal),
    ));
    expect(listNearbyCleanupEventMap).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Load viewport" }));
    expect(listNearbyCleanupEventMap).toHaveBeenCalledTimes(1);
    expect(listPublicCleanupEventMap).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Load more events" }));
    await waitFor(() => expect(listNearbyCleanupEventMap).toHaveBeenLastCalledWith(
      "token",
      expect.objectContaining({ cursor: "event-page-2" }),
      expect.any(AbortSignal),
    ));
    expect(listNearbyCleanupEventMap).toHaveBeenCalledTimes(2);
    expect(listNearbyPublicIncidents).not.toHaveBeenCalled();
    expect(screen.getByTestId("search-radius").textContent).toBe("2000");

    fireEvent.change(screen.getByLabelText("Search radius"), { target: { value: "5000" } });
    await waitFor(() => expect(listNearbyCleanupEventMap).toHaveBeenLastCalledWith(
      "token",
      expect.objectContaining({ radiusMeters: 5_000, cursor: undefined }),
      expect.any(AbortSignal),
    ));
    expect(screen.getByTestId("search-radius").textContent).toBe("5000");
  });

  test("citizen map loads only cleanup events and opens their existing detail and join flow", async () => {
    vi.mocked(listNearbyCleanupEventMap).mockResolvedValue({
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        geometry: { type: "Point", coordinates: [79.8601, 6.9101] },
        properties: {
          id: "event-filtered",
          kind: "CLEANUP_EVENT",
          title: "Beach cleanup",
          status: "PUBLISHED",
          occurredAt: "2026-08-21T00:00:00.000Z",
          organizationId: "organization-1",
          organizationName: "Coast Team",
          incidentId: "incident-filtered",
          isJoined: false,
          isOwned: false,
        },
      }],
      nextCursor: null,
    });
    const getCurrentPosition = vi.fn((success: PositionCallback) => success({
      coords: {
        latitude: 6.9271,
        longitude: 79.8612,
        accuracy: 10,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
        toJSON: () => ({}),
      },
      timestamp: 1,
      toJSON: () => ({}),
    }));
    Object.defineProperty(window.navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition },
    });
    vi.mocked(getPublicCleanupEvent).mockResolvedValue({
      id: "event-filtered",
      organization: { id: "organization-1", name: "Coast Team" },
      incidentId: "incident-filtered",
      title: "Beach cleanup",
      description: "Remove plastic waste from the public beach.",
      publicInstructions: "Bring gloves and drinking water.",
      lifecycleStatus: "PUBLISHED",
      eventLatitude: 6.9101,
      eventLongitude: 79.8601,
      eventAddress: "Public beach",
      meetingLatitude: 6.9101,
      meetingLongitude: 79.8601,
      meetingAddress: "Beach entrance",
      publishedAt: "2026-08-21T00:00:00.000Z",
      firstSessionAt: "2026-08-23T08:00:00.000Z",
      sessions: [{
        id: "session-1",
        sessionDate: "2026-08-23",
        startTime: "08:00:00",
        endTime: "10:00:00",
        capacity: 20,
        locationLatitude: 6.9101,
        locationLongitude: 79.8601,
        locationAddress: "Beach entrance",
      }],
    });

    const onOpenEvent = vi.fn();
    render(<CitizenIncidentDiscovery accessToken="token" onOpenEvent={onOpenEvent} />);
    fireEvent.click(screen.getByRole("button", { name: "Use my location" }));
    await waitFor(() => expect(screen.getByTestId("marker-ids").textContent).toBe("event-filtered"));
    expect(screen.queryByRole("complementary", { name: "Published cleanup events" })).toBeNull();
    expect(screen.getByTestId("selected-marker").textContent).toBe("none");
    fireEvent.click(screen.getByRole("button", { name: "Map marker Beach cleanup" }));
    expect(screen.getByTestId("selected-marker").textContent).toBe("event-filtered");
    expect(await screen.findByText("Remove plastic waste from the public beach.")).toBeTruthy();
    expect(screen.getByText(/Bring gloves and drinking water/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Join event" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Join event: Beach cleanup from map" }));
    expect(onOpenEvent).toHaveBeenCalledWith("event-filtered");
    expect(listPublicIncidents).not.toHaveBeenCalled();
    expect(getPublicIncident).not.toHaveBeenCalled();
  });

  test("organization map renders empty results without exposing review actions", async () => {
    render(
      <OrganizationIncidentDiscovery
        accessToken="token"
        organizationId="00000000-0000-4000-8000-000000000001"
        canReview={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Load viewport" }));

    expect(await screen.findByText("No covered incidents in this view")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /submit review/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /create cleanup draft/i })).toBeNull();
  });

  test("organization overlap renders both service areas and one deduplicated incident", async () => {
    vi.mocked(listOrganizationIncidents).mockResolvedValue({
      items: [{
        id: "overlap-incident",
        title: "Incident in both service areas",
        category: { id: "category-1", name: "Waste", description: null },
        severity: "MEDIUM",
        status: "ACTIVE",
        latitude: 6.91,
        longitude: 79.86,
        addressText: null,
        reportedAt: "2026-08-20T00:00:00.000Z",
        falseReviewCount: 0,
        currentReviewStatus: null,
      }],
      nextCursor: null,
    });
    vi.mocked(listOrganizationServiceAreaBoundaries).mockResolvedValue({
      type: "FeatureCollection",
      features: ["area-a", "area-b"].map((id) => ({
        type: "Feature" as const,
        geometry: {
          type: "Polygon" as const,
          coordinates: [[[79.8, 6.8], [80, 6.8], [80, 7], [79.8, 6.8]]],
        },
        properties: { id, name: id, officialCode: null, status: "APPROVED" },
      })),
      truncated: false,
    });

    render(
      <OrganizationIncidentDiscovery
        accessToken="token"
        organizationId="00000000-0000-4000-8000-000000000001"
        canReview={false}
      />,
    );

    await waitFor(() => expect(screen.getByTestId("boundary-ids").textContent).toBe("area-a,area-b"));
    expect(listOrganizationServiceAreaBoundaries).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Load viewport" }));

    await waitFor(() => expect(screen.getByTestId("marker-ids").textContent).toBe("overlap-incident"));
    expect(listOrganizationServiceAreaBoundaries).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("marker-ids").textContent).toBe("overlap-incident");
    expect(screen.getAllByText("Incident in both service areas")).toHaveLength(2);
  });

  test("organization selection keeps authorized review and cleanup actions on the selected incident", async () => {
    const incidents = ["first", "second"].map((id, index) => ({
      id: `incident-${id}`,
      title: `${id} covered incident`,
      category: { id: "category-1", name: "Waste", description: null },
      severity: "MEDIUM" as const,
      status: "ACTIVE" as const,
      latitude: 6.91 + index * 0.001,
      longitude: 79.86 + index * 0.001,
      addressText: null,
      reportedAt: "2026-08-20T00:00:00.000Z",
      falseReviewCount: 0,
      currentReviewStatus: null,
    }));
    vi.mocked(listOrganizationIncidents).mockResolvedValue({ items: incidents, nextCursor: null });
    vi.mocked(getOrganizationIncidentDetail).mockImplementation(async (_token, _organizationId, incidentId) => {
      const incident = incidents.find((item) => item.id === incidentId)!;
      return {
        ...incident,
        description: `Private review detail for ${incidentId}`,
        highlightUntil: "2026-09-01T00:00:00.000Z",
        archiveAfter: "2026-10-01T00:00:00.000Z",
        resolvedAt: null,
        archivedAt: null,
        thumbnailUrl: null,
        photos: [],
        statusHistory: [],
        accessSource: "CURRENT_SERVICE_AREA",
        currentReview: null,
      };
    });
    const onCreateDraftFromIncident = vi.fn();

    render(
      <OrganizationIncidentDiscovery
        accessToken="token"
        organizationId="00000000-0000-4000-8000-000000000001"
        canReview
        onCreateDraftFromIncident={onCreateDraftFromIncident}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Load viewport" }));
    fireEvent.click(await screen.findByRole("button", { name: "Map marker second covered incident" }));

    expect(await screen.findByText("Private review detail for incident-second")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save review" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Create cleanup-event draft" }));
    expect(onCreateDraftFromIncident).toHaveBeenCalledWith("incident-second");
    expect(screen.getByTestId("selected-marker").textContent).toBe("incident-second");
  });

  test("Super Admin selection stays synchronized and remains read-only", async () => {
    vi.mocked(listPublicIncidents).mockResolvedValue({
      items: [{
        id: "incident-1",
        title: "Dense shoreline waste",
        category: { id: "category-1", name: "Waste", description: null },
        severity: "HIGH",
        status: "ACTIVE",
        latitude: 6.91,
        longitude: 79.86,
        addressText: null,
        reportedAt: "2026-08-20T00:00:00.000Z",
        falseReviewCount: 0,
        isOwnReport: false,
      }],
      nextCursor: null,
    });

    render(<SuperAdminMapOverview accessToken="token" />);
    fireEvent.click(screen.getByRole("button", { name: "Load viewport" }));
    const marker = await screen.findByRole("button", { name: "Map marker Dense shoreline waste" });
    fireEvent.click(marker);

    await waitFor(() => expect(screen.getByTestId("selected-marker").textContent).toBe("incident-1"));
    expect(screen.queryByRole("button", { name: /assign/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /operate/i })).toBeNull();
  });
});
