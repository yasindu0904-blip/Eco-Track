import TestRenderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, test, vi } from "vitest";

import * as Location from "expo-location";
import {
  getPublicCleanupEvent,
  listNearbyCleanupEventMap,
  listPublicCleanupEventMap,
} from "../cleanupEvents/cleanupEvent.api";
import {
  getPublicIncident,
  listIncidentCategories,
  listNearbyPublicIncidents,
  listPublicIncidents,
} from "./incident.api";
import { CitizenIncidentDiscoveryScreen } from "./CitizenIncidentDiscoveryScreen";

const testState = vi.hoisted(() => ({
  foregroundRefresh: undefined as (() => void) | undefined,
}));

vi.mock("expo-location", () => ({
  Accuracy: { Balanced: 3 },
  PermissionStatus: { DENIED: "denied", GRANTED: "granted" },
  getCurrentPositionAsync: vi.fn(),
  requestForegroundPermissionsAsync: vi.fn(),
}));

vi.mock("react-native", () => ({
  ActivityIndicator: "ActivityIndicator",
  Pressable: "Pressable",
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: "Text",
  View: "View",
}));

vi.mock("../../components/ui", async () => {
  const React = await import("react");
  return {
    Button: ({ label, onPress, disabled, loading }: {
      label: string;
      onPress: () => void;
      disabled?: boolean;
      loading?: boolean;
    }) => React.createElement("Button", {
      accessibilityLabel: label,
      accessibilityRole: "button",
      disabled: Boolean(disabled || loading),
      onPress,
    }, label),
    Notice: ({ message }: { message: string }) => React.createElement("Text", null, message),
    PageHeader: ({ title, subtitle }: { title: string; subtitle?: string }) =>
      React.createElement("View", null,
        React.createElement("Text", null, title),
        subtitle ? React.createElement("Text", null, subtitle) : null,
      ),
    Screen: ({ children }: { children: React.ReactNode }) => React.createElement("View", null, children),
    sharedStyles: { card: {}, divider: {}, sectionSubtitle: {}, sectionTitle: {}, spacedRow: {} },
  };
});

vi.mock("../../components/theme", () => ({
  colors: { primary: "green", primarySoft: "lightgreen", surface: "white", text: "black", textMuted: "gray", border: "gray" },
}));

vi.mock("../../api/apiError", () => ({
  describeApiFailure: (error: unknown, fallbackMessage: string) => ({
    message: error instanceof Error ? error.message : fallbackMessage,
  }),
}));

vi.mock("../map", async () => {
  const React = await import("react");
  return {
    EcoMap: (props: Record<string, unknown>) => React.createElement("EcoMap", props),
    COLOMBO_MAP_CENTER: { latitude: 6.9271, longitude: 79.8612 },
    SRI_LANKA_MAP_BOUNDS: { west: 79.5, south: 5.8, east: 82, north: 10 },
    useRefreshOnForeground: (refresh: () => void) => {
      testState.foregroundRefresh = refresh;
    },
  };
});

vi.mock("./incident.api", () => ({
  getPublicIncident: vi.fn(),
  listIncidentCategories: vi.fn(),
  listNearbyPublicIncidents: vi.fn(),
  listPublicIncidents: vi.fn(),
}));

vi.mock("../cleanupEvents/cleanupEvent.api", () => ({
  getPublicCleanupEvent: vi.fn(),
  listNearbyCleanupEventMap: vi.fn(),
  listPublicCleanupEventMap: vi.fn(),
}));

const viewport = { west: 79.8, south: 6.8, east: 80, north: 7, zoom: 12 };
const emptyEventPage = { type: "FeatureCollection" as const, features: [], nextCursor: null };
const event = {
  type: "Feature" as const,
  geometry: { type: "Point" as const, coordinates: [79.8601, 6.9101] as [number, number] },
  properties: {
    id: "event-mobile",
    kind: "CLEANUP_EVENT" as const,
    title: "Mobile cleanup",
    status: "PUBLISHED",
    occurredAt: "2026-08-21T00:00:00.000Z",
    organizationId: "organization-1",
    organizationName: "Coast Team",
    incidentId: "incident-mobile",
    isJoined: false,
    isOwned: false,
  },
};

function renderScreen(onOpenEvent = vi.fn()): TestRenderer.ReactTestRenderer {
  return TestRenderer.create(
    <CitizenIncidentDiscoveryScreen
      accessToken="token"
      onBack={vi.fn()}
      onReportIncident={vi.fn()}
      onOpenEvent={onOpenEvent}
    />,
  );
}

function textContent(renderer: TestRenderer.ReactTestRenderer): string[] {
  return renderer.root
    .findAll((node) => typeof node.children[0] === "string")
    .map((node) => node.children.join(""));
}

function button(renderer: TestRenderer.ReactTestRenderer, label: string) {
  return renderer.root.findByProps({ accessibilityLabel: label });
}

function map(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root.findByType("EcoMap" as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  testState.foregroundRefresh = undefined;
  vi.mocked(getPublicCleanupEvent).mockResolvedValue(undefined as never);
  vi.mocked(listPublicCleanupEventMap).mockResolvedValue(emptyEventPage);
  vi.mocked(listNearbyCleanupEventMap).mockResolvedValue(emptyEventPage);
});

describe("mobile citizen cleanup-event discovery", () => {
  test("weak-network failure remains retryable without requesting incidents", async () => {
    vi.mocked(listPublicCleanupEventMap)
      .mockRejectedValueOnce(new Error("weak network"))
      .mockResolvedValue(emptyEventPage);
    let renderer: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = renderScreen();
    });
    await act(async () => {
      await map(renderer!).props.onViewportChange(viewport, {
        signal: new AbortController().signal,
        requestId: 1,
      });
    });

    expect(textContent(renderer!)).toContain("weak network");
    await act(async () => {
      await button(renderer!, "Refresh events").props.onPress();
    });
    expect(textContent(renderer!)).toContain("No published cleanup events found");
    expect(listPublicIncidents).not.toHaveBeenCalled();
    expect(listIncidentCategories).not.toHaveBeenCalled();
  });

  test("foreground location loads every cleanup-event page in the two-kilometre search", async () => {
    vi.mocked(listNearbyCleanupEventMap)
      .mockResolvedValueOnce({ ...emptyEventPage, nextCursor: "event-page-2" })
      .mockResolvedValueOnce(emptyEventPage);
    vi.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({
      granted: true,
      canAskAgain: true,
      expires: "never",
      status: Location.PermissionStatus.GRANTED,
    });
    vi.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
      coords: {
        latitude: 6.9271,
        longitude: 79.8612,
        altitude: null,
        accuracy: 10,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: 1,
    });
    let renderer: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = renderScreen();
    });
    await act(async () => {
      await button(renderer!, "Use my location").props.onPress();
    });

    expect(listNearbyCleanupEventMap).toHaveBeenCalledTimes(2);
    expect(listNearbyCleanupEventMap).toHaveBeenCalledWith(
      "token",
      expect.objectContaining({ latitude: 6.9271, longitude: 79.8612, radiusMeters: 2_000, limit: 50 }),
      expect.any(AbortSignal),
    );
    expect(listNearbyCleanupEventMap).toHaveBeenLastCalledWith(
      "token",
      expect.objectContaining({ cursor: "event-page-2" }),
      expect.any(AbortSignal),
    );
    expect(listNearbyPublicIncidents).not.toHaveBeenCalled();
    expect(map(renderer!).props.searchRadiusMeters).toBe(2_000);
  });

  test("event marker selection loads details and opens the join flow", async () => {
    vi.mocked(listPublicCleanupEventMap).mockResolvedValue({
      type: "FeatureCollection",
      features: [event],
      nextCursor: null,
    });
    vi.mocked(getPublicCleanupEvent).mockResolvedValue({
      id: "event-mobile",
      organization: { id: "organization-1", name: "Coast Team" },
      incidentId: "incident-mobile",
      title: "Mobile cleanup",
      description: "Remove litter from the cleanup area.",
      publicInstructions: "Wear closed shoes.",
      lifecycleStatus: "PUBLISHED",
      eventLatitude: 6.9101,
      eventLongitude: 79.8601,
      eventAddress: "Cleanup area",
      meetingLatitude: 6.9101,
      meetingLongitude: 79.8601,
      meetingAddress: "Community entrance",
      publishedAt: "2026-08-21T00:00:00.000Z",
      firstSessionAt: "2026-08-23T08:00:00.000Z",
      sessions: [{
        id: "session-mobile",
        sessionDate: "2026-08-23",
        startTime: "08:00:00",
        endTime: "10:00:00",
        capacity: 20,
        locationLatitude: 6.9101,
        locationLongitude: 79.8601,
        locationAddress: "Community entrance",
      }],
    });
    const onOpenEvent = vi.fn();
    let renderer: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = renderScreen(onOpenEvent);
    });
    await act(async () => {
      await map(renderer!).props.onViewportChange(viewport, {
        signal: new AbortController().signal,
        requestId: 1,
      });
    });

    expect(map(renderer!).props.markers).toEqual([event]);
    expect(map(renderer!).props.selectedMarkerId).toBeUndefined();
    expect(listPublicIncidents).not.toHaveBeenCalled();
    await act(async () => {
      map(renderer!).props.onMarkerSelect(event);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getPublicCleanupEvent).toHaveBeenCalledWith("token", "event-mobile", expect.any(AbortSignal));
    expect(textContent(renderer!)).toContain("Remove litter from the cleanup area.");
    expect(map(renderer!).props.markerActionLabel(event)).toBe("Join event: Mobile cleanup");
    await act(async () => {
      button(renderer!, "Join event").props.onPress();
    });
    expect(onOpenEvent).toHaveBeenCalledWith("event-mobile");
    expect(getPublicIncident).not.toHaveBeenCalled();
  });

  test("returning from background refreshes only cleanup events", async () => {
    let renderer: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = renderScreen();
    });
    await act(async () => {
      await map(renderer!).props.onViewportChange(viewport, {
        signal: new AbortController().signal,
        requestId: 1,
      });
    });
    expect(listPublicCleanupEventMap).toHaveBeenCalledTimes(1);

    await act(async () => {
      testState.foregroundRefresh?.();
      await Promise.resolve();
    });
    expect(listPublicCleanupEventMap).toHaveBeenCalledTimes(2);
    expect(listPublicIncidents).not.toHaveBeenCalled();
  });
});
