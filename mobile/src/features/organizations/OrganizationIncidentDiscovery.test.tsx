import TestRenderer, { act } from "react-test-renderer";
import { expect, test, vi } from "vitest";
import { OrganizationIncidentDiscovery } from "./OrganizationIncidentDiscovery";
import { getPublicCleanupEvent, listOrganizationCleanupEventMap } from "../cleanupEvents/cleanupEvent.api";
import { getOrganizationIncidentDetail, listOrganizationIncidents } from "./organizationIncidentDiscovery.api";

vi.mock("../../api/apiError", () => ({ describeApiFailure: (error: unknown, fallback: string) => ({ message: error instanceof Error ? error.message : fallback }) }));
vi.mock("react-native", () => ({
  ActivityIndicator: "ActivityIndicator", Image: "Image", Pressable: "Pressable",
  StyleSheet: { create: <T,>(value: T) => value }, Text: "Text", TextInput: "TextInput", View: "View",
}));
vi.mock("../../components/ui", () => ({ Button: "Button", Notice: "Notice", sharedStyles: {} }));
vi.mock("../map", () => ({ EcoMap: "EcoMap", AdministrativeAreaMapSearch: "AreaSearch", useRefreshOnForeground: vi.fn() }));
vi.mock("../incidents/incident.api", () => ({ listIncidentCategories: vi.fn().mockResolvedValue([]) }));
vi.mock("../cleanupEvents/cleanupEvent.api", () => ({ getPublicCleanupEvent: vi.fn(), listOrganizationCleanupEventMap: vi.fn() }));
vi.mock("./organizationIncidentDiscovery.api", () => ({
  getOrganizationIncidentDetail: vi.fn(), listOrganizationIncidents: vi.fn(),
  listOrganizationServiceAreaBoundaries: vi.fn().mockResolvedValue({ type: "FeatureCollection", features: [], truncated: false }),
  updateOrganizationIncidentReview: vi.fn(),
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

test("organized incidents and standalone public events show shared details without another tenant's management actions", async () => {
  const incident = {
    id: "incident", title: "Beach waste", category: { id: "waste", name: "Waste", description: null },
    severity: "MEDIUM" as const, status: "CLEANUP_ORGANIZED" as const, latitude: 6.91, longitude: 79.86,
    addressText: "Beach", reportedAt: "2026-08-20T00:00:00.000Z", falseReviewCount: 0, currentReviewStatus: null,
  };
  const event = {
    id: "event", title: "Beach cleanup", organization: { id: "other-org", name: "Coastal volunteers" },
    incidentId: incident.id, description: "Clean the shoreline.", publicInstructions: "Meet by the pier.",
    lifecycleStatus: "PUBLISHED" as const, displayStatus: "ONGOING" as const,
    eventLatitude: 6.91, eventLongitude: 79.86, eventAddress: "Beach", meetingLatitude: null,
    meetingLongitude: null, meetingAddress: null, startsAt: "2026-08-21T08:00:00.000Z",
    publishedAt: "2026-08-20T08:00:00.000Z", capacity: null, joinedVolunteerCount: 0,
  };
  vi.mocked(listOrganizationIncidents).mockResolvedValue({ items: [incident], nextCursor: null });
  vi.mocked(getOrganizationIncidentDetail).mockResolvedValue({
    ...incident, description: "Scattered plastic waste.", highlightUntil: "2026-09-01T00:00:00.000Z",
    archiveAfter: "2026-10-01T00:00:00.000Z", resolvedAt: null, archivedAt: null, thumbnailUrl: null,
    photos: [], statusHistory: [], accessSource: "CURRENT_SERVICE_AREA", currentReview: null, activeCleanupEvent: event,
  });
  vi.mocked(listOrganizationCleanupEventMap).mockResolvedValue({ type: "FeatureCollection", nextCursor: null,
    features: [event, { ...event, id: "standalone", title: "Independent cleanup", incidentId: null }].map(item => ({
      type: "Feature", geometry: { type: "Point", coordinates: [79.86, 6.91] },
      properties: { id: item.id, kind: "CLEANUP_EVENT", title: item.title, status: "ONGOING", occurredAt: item.publishedAt,
        organizationId: "other-org", organizationName: "Coastal volunteers", incidentId: item.incidentId, isOwned: false, isJoined: false },
    })),
  });
  vi.mocked(getPublicCleanupEvent).mockResolvedValue({ ...event, id: "standalone", incidentId: null });
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(<OrganizationIncidentDiscovery accessToken="token" organizationId="my-org" onMapInteractionChange={vi.fn()} canReview onOpenEvent={vi.fn()} onCreateDraftFromIncident={vi.fn()} />); });
  expect(renderer.root.findAllByProps({ children: "Resolved" })).toHaveLength(0);
  const map = () => renderer.root.findByType("EcoMap" as never);
  await act(async () => { await map().props.onViewportChange({ west: 79.8, south: 6.8, east: 80, north: 7, zoom: 12 }, { signal: new AbortController().signal, requestId: 1 }); });
  expect(map().props.markers.map((marker: { properties: { id: string } }) => marker.properties.id)).toEqual(["incident", "standalone"]);
  expect(map().props.markers[0].properties.status).toBe("CLEANUP_ORGANIZED");
  await act(async () => { map().props.onMarkerSelect(map().props.markers[0]); });
  expect(JSON.stringify(renderer.toJSON())).toContain("Scattered plastic waste.");
  expect(JSON.stringify(renderer.toJSON())).toContain("Clean the shoreline.");
  expect(JSON.stringify(renderer.toJSON())).toContain("Meet by the pier.");
  expect(renderer.root.findAllByProps({ label: "Create cleanup-event draft" })).toHaveLength(0);
  await act(async () => { map().props.onMarkerSelect(map().props.markers[1]); });
  expect(getPublicCleanupEvent).toHaveBeenCalledWith("token", "standalone", expect.any(AbortSignal));
  expect(JSON.stringify(renderer.toJSON())).toContain("Clean the shoreline.");
  expect(JSON.stringify(renderer.toJSON())).not.toContain("Scattered plastic waste.");
  expect(renderer.root.findAllByProps({ label: "Open selected event" })).toHaveLength(0);
  await act(async () => renderer.unmount());
});
