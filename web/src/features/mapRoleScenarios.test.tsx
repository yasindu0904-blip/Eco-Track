// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { listPublicCleanupEventMap } from "./cleanup-events/cleanupEvent.api";
import { CitizenIncidentDiscovery } from "./incidents/CitizenIncidentDiscovery";
import { listIncidentCategories, listPublicIncidents } from "./incidents/incident.api";
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
        <output data-testid="marker-ids">
          {(props.markers ?? []).map((marker) => marker.properties.id).join(",") || "none"}
        </output>
        <output data-testid="boundary-ids">
          {(props.boundaries?.features ?? []).map((boundary) => boundary.properties.id).join(",") || "none"}
        </output>
        {(props.markers ?? []).map((marker: MapMarkerFeature) => (
          <button
            type="button"
            key={`${marker.properties.kind}-${marker.properties.id}`}
            onClick={() => props.onMarkerSelect?.(marker)}
          >
            Map marker {marker.properties.title}
          </button>
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
  vi.mocked(listPublicCleanupEventMap).mockResolvedValue(emptyEventPage);
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
  test("citizen map recovers from an API error into a usable empty state", async () => {
    vi.mocked(listPublicIncidents)
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValue(emptyIncidentPage);

    render(<CitizenIncidentDiscovery accessToken="token" />);
    fireEvent.click(screen.getByRole("button", { name: "Load viewport" }));

    expect((await screen.findByRole("alert")).textContent).toContain("network unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("No incidents found")).toBeTruthy();
  });

  test("citizen map remains usable after browser location permission is denied", async () => {
    const getCurrentPosition = vi.fn(
      (_success: PositionCallback, error: PositionErrorCallback) =>
        error({ code: 1, message: "denied", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }),
    );
    Object.defineProperty(window.navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition },
    });

    render(<CitizenIncidentDiscovery accessToken="token" />);
    fireEvent.click(screen.getByRole("button", { name: "Find activity near me" }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Location permission was denied or your current position is unavailable.",
    );
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Load viewport" }));
    expect(await screen.findByText("No incidents found")).toBeTruthy();
  });

  test("citizen filters keep map, list, and selection synchronized", async () => {
    vi.mocked(listPublicIncidents).mockResolvedValue({
      items: [{
        id: "incident-filtered",
        title: "Plastic on the beach",
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
    vi.mocked(listPublicCleanupEventMap).mockResolvedValue({
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

    render(<CitizenIncidentDiscovery accessToken="token" />);
    fireEvent.click(screen.getByRole("button", { name: "Load viewport" }));
    await waitFor(() => expect(screen.getByTestId("marker-ids").textContent)
      .toBe("incident-filtered,event-filtered"));
    expect(screen.getByTestId("selected-marker").textContent).toBe("incident-filtered");

    fireEvent.change(screen.getByLabelText("Activity"), {
      target: { value: "CLEANUP_EVENT" },
    });
    expect(screen.getByTestId("marker-ids").textContent).toBe("event-filtered");
    expect(screen.getByTestId("selected-marker").textContent).toBe("event-filtered");
    expect(screen.queryByText("Plastic on the beach")).toBeNull();
    expect(screen.getAllByText("Beach cleanup").length).toBeGreaterThan(0);
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
    fireEvent.click(screen.getByRole("button", { name: "Load viewport" }));

    await waitFor(() => expect(screen.getByTestId("boundary-ids").textContent).toBe("area-a,area-b"));
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
