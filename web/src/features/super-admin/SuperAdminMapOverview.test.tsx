// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { SuperAdminMapOverview } from "./SuperAdminMapOverview";
import { getPublicIncident, listPublicIncidents } from "../incidents/incident.api";
import { getPublicCleanupEvent, listPublicCleanupEventMap } from "../cleanup-events/cleanupEvent.api";
import { getAdministrativeAreaBoundary, listAdministrativeAreas } from "../organizations/application/organizationApplication.api";

const viewport = { west: 79.8, south: 6.8, east: 80, north: 7, zoom: 12 };
vi.mock("../maps", async () => {
  const actual = await vi.importActual<typeof import("../maps")>("../maps");
  return { ...actual, EcoMap: (props: ComponentProps<typeof actual.EcoMap>) => <div>
    <button onClick={() => void props.onViewportChange?.(viewport, { signal: new AbortController().signal, requestId: 1 })}>Load viewport</button>
    <output data-testid="coordinates-visible">{String(props.showMarkerCoordinates)}</output>
    {props.markers?.map((marker) => <button key={marker.properties.id} onClick={() => props.onMarkerSelect?.(marker)}>{marker.properties.title}</button>)}
  </div> };
});
vi.mock("../incidents/incident.api", () => ({ getPublicIncident: vi.fn(), listPublicIncidents: vi.fn() }));
vi.mock("../cleanup-events/cleanupEvent.api", () => ({ getPublicCleanupEvent: vi.fn(), listPublicCleanupEventMap: vi.fn() }));
vi.mock("../organizations/application/organizationApplication.api", () => ({ getAdministrativeAreaBoundary: vi.fn(), listAdministrativeAreas: vi.fn() }));
const incident = {
  id: "incident-1", title: "Canal waste", description: "Plastic waste along the canal.",
  category: { id: "waste", name: "Waste", description: null }, severity: "HIGH" as const,
  status: "ACTIVE" as const, latitude: 6.9, longitude: 79.9, addressText: "Canal road",
  reportedAt: "2026-10-01T10:00:00Z", thumbnailUrl: null, falseReviewCount: 0, isOwnReport: false,
  highlightUntil: "2026-10-03T10:00:00Z", archiveAfter: "2026-10-08T10:00:00Z",
  resolvedAt: null, archivedAt: null, statusHistory: [],
  photos: [{ id: "photo-1", url: "https://example.test/evidence.jpg", caption: "Plastic bottles", sortOrder: 0 }],
};
const marker = { type: "Feature" as const, geometry: { type: "Point" as const, coordinates: [79.9, 6.9] as [number, number] },
  properties: { id: "event-1", kind: "CLEANUP_EVENT" as const, title: "Canal cleanup", status: "UPCOMING", incidentId: incident.id,
    occurredAt: "2026-10-01T10:00:00Z", organizationId: "org-1", organizationName: "Green team", isJoined: false, isOwned: false } };
const event = { id: marker.properties.id, title: marker.properties.title, description: "Remove canal waste together.",
  organization: { id: "org-1", name: "Green team" }, incidentId: incident.id, lifecycleStatus: "PUBLISHED" as const,
  displayStatus: "UPCOMING" as const, eventLatitude: 6.9, eventLongitude: 79.9, eventAddress: "Canal road",
  startsAt: "2099-10-04T10:00:00Z", capacity: 20, publishedAt: "2026-10-01T10:00:00Z",
  publicInstructions: "Bring gloves.", meetingLatitude: null, meetingLongitude: null, meetingAddress: "Canal entrance", joinedVolunteerCount: 3 };
const area = { id: "07e253e8-e6f8-4f67-b82a-831a32dc0462", name: "Canal GN", officialCode: "GN01", gnNumber: "1",
  divisionalSecretariatName: "Colombo", districtName: "Colombo", provinceName: "Western" };
const boundary = { type: "FeatureCollection" as const, features: [{ type: "Feature" as const,
  properties: { id: area.id, name: area.name, officialCode: area.officialCode, divisionalSecretariatName: "Colombo", districtName: "Colombo" },
  geometry: { type: "Polygon" as const, coordinates: [[[79.85, 6.85], [79.95, 6.85], [79.95, 6.95], [79.85, 6.85]]] } }] };

beforeEach(() => {
  vi.mocked(listPublicIncidents).mockResolvedValue({ items: [incident], nextCursor: null });
  vi.mocked(listPublicCleanupEventMap).mockResolvedValue({ type: "FeatureCollection", features: [marker], nextCursor: null });
  vi.mocked(getPublicIncident).mockResolvedValue(incident);
  vi.mocked(getPublicCleanupEvent).mockResolvedValue(event);
  vi.mocked(listAdministrativeAreas).mockResolvedValue([area]);
  vi.mocked(getAdministrativeAreaBoundary).mockResolvedValue(boundary);
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

async function loadMap() {
  render(<SuperAdminMapOverview accessToken="token" />);
  fireEvent.click(screen.getByRole("button", { name: "Load viewport" }));
  await screen.findByRole("button", { name: incident.title });
}
async function chooseArea() {
  fireEvent.change(screen.getByRole("textbox", { name: "Find a GN Division" }), { target: { value: "Canal" } });
  fireEvent.click(await screen.findByRole("button", { name: /Canal GN.*Colombo/ }));
  await waitFor(() => expect(listPublicIncidents).toHaveBeenLastCalledWith("token", expect.objectContaining({ administrativeAreaId: area.id }), expect.any(AbortSignal)));
}

test("categories query the backend before pagination and hide coordinates", async () => {
  await loadMap();
  expect(screen.getByTestId("coordinates-visible").textContent).toBe("false");
  fireEvent.click(screen.getByRole("button", { name: "Awaiting cleanup" }));
  await waitFor(() => expect(listPublicIncidents).toHaveBeenLastCalledWith("token", expect.objectContaining({ awaitingCleanup: true }), expect.any(AbortSignal)));
  expect(screen.queryByRole("button", { name: marker.properties.title })).toBeNull();
  for (const [label, section] of [["Upcoming", "upcoming"], ["Ongoing", "ongoing"], ["Completed", "past"], ["Cancelled", "cancelled"]]) {
    fireEvent.click(screen.getByRole("button", { name: label }));
    await waitFor(() => expect(listPublicCleanupEventMap).toHaveBeenLastCalledWith("token", expect.objectContaining({ section }), expect.any(AbortSignal)));
    expect(screen.queryByRole("button", { name: incident.title })).toBeNull();
  }
});

test("GN selection and subsequent cursor pages retain the polygon filter; clearing restores the viewport", async () => {
  vi.mocked(listPublicIncidents).mockResolvedValue({ items: [incident], nextCursor: "next-incident" });
  await loadMap();
  await chooseArea();
  await waitFor(() => expect(listPublicCleanupEventMap).toHaveBeenLastCalledWith("token", expect.objectContaining({ administrativeAreaId: area.id }), expect.any(AbortSignal)));
  fireEvent.click(screen.getByRole("button", { name: "Load more public markers" }));
  await waitFor(() => expect(listPublicIncidents).toHaveBeenLastCalledWith("token", expect.objectContaining({ administrativeAreaId: area.id, cursor: "next-incident" }), expect.any(AbortSignal)));
  fireEvent.click(screen.getByRole("button", { name: "Clear GN Division" }));
  await waitFor(() => expect(listPublicIncidents).toHaveBeenLastCalledWith("token", expect.objectContaining({ administrativeAreaId: undefined, cursor: undefined }), expect.any(AbortSignal)));
});

test("selecting incidents and events shows real details and linked incident photos", async () => {
  await loadMap();
  fireEvent.click(screen.getByRole("button", { name: incident.title }));
  expect(await screen.findByText(incident.description)).toBeTruthy();
  expect(screen.getByRole("img", { name: "Plastic bottles" }).getAttribute("src")).toBe(incident.photos[0].url);
  fireEvent.click(screen.getByRole("button", { name: marker.properties.title }));
  expect(await screen.findByText(event.description)).toBeTruthy();
  expect(screen.getByText("Green team")).toBeTruthy();
  expect(screen.getByText("Bring gloves.")).toBeTruthy();
  expect(screen.getByText("3 / 20")).toBeTruthy();
  await waitFor(() => expect(getPublicIncident).toHaveBeenLastCalledWith("token", incident.id, expect.any(AbortSignal)));
  fireEvent.click(screen.getByRole("button", { name: "Close details" }));
  expect(screen.queryByRole("article", { name: "Cleanup event details" })).toBeNull();
});

test("a late viewport response cannot restore an older category", async () => {
  let resolveOld!: (page: { items: typeof incident[]; nextCursor: null }) => void;
  vi.mocked(listPublicIncidents).mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
  render(<SuperAdminMapOverview accessToken="token" />);
  fireEvent.click(screen.getByRole("button", { name: "Load viewport" }));
  fireEvent.click(screen.getByRole("button", { name: "Completed" }));
  await screen.findByRole("button", { name: marker.properties.title });
  resolveOld({ items: [incident], nextCursor: null });
  await waitFor(() => expect(screen.queryByRole("button", { name: incident.title })).toBeNull());
});

test("clearing a division while its boundary loads ignores that stale boundary", async () => {
  let resolveBoundary!: (value: typeof boundary) => void;
  vi.mocked(getAdministrativeAreaBoundary).mockImplementationOnce(() => new Promise((resolve) => { resolveBoundary = resolve; }));
  await loadMap();
  fireEvent.change(screen.getByRole("textbox", { name: "Find a GN Division" }), { target: { value: "Canal" } });
  fireEvent.click(await screen.findByRole("button", { name: /Canal GN.*Colombo/ }));
  fireEvent.click(screen.getByRole("button", { name: "Clear GN Division" }));
  resolveBoundary(boundary);
  await waitFor(() => expect(screen.queryByText("Canal GN", { selector: "strong" })).toBeNull());
  expect(screen.getByRole("button", { name: incident.title })).toBeTruthy();
});

test("failed details can be retried and empty categories are explicit", async () => {
  await loadMap();
  vi.mocked(getPublicIncident).mockRejectedValueOnce(new Error("network unavailable"));
  fireEvent.click(screen.getByRole("button", { name: incident.title }));
  fireEvent.click(await screen.findByRole("button", { name: "Retry details" }));
  expect(await screen.findByText(incident.description)).toBeTruthy();
  vi.mocked(listPublicCleanupEventMap).mockResolvedValue({ type: "FeatureCollection", features: [], nextCursor: null });
  fireEvent.click(screen.getByRole("button", { name: "Completed" }));
  expect(await screen.findByText("No completed cleanup events found in this view.")).toBeTruthy();
});
