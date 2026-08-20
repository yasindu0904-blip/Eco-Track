import TestRenderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, test, vi } from "vitest";

import * as Location from "expo-location";
import {
  getPublicIncident,
  listIncidentCategories,
  listNearbyPublicIncidents,
  listPublicIncidents,
} from "./incident.api";
import {
  getPublicCleanupEvent,
  listNearbyCleanupEventMap,
  listPublicCleanupEventMap,
} from "../cleanupEvents/cleanupEvent.api";
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
    Screen: ({ children }: { children: React.ReactNode }) => React.createElement("View", null, children),
    sharedStyles: {
      card: {}, divider: {}, sectionSubtitle: {}, sectionTitle: {}, spacedRow: {},
    },
  };
});

vi.mock("../../components/theme", () => ({
  colors: { primary: "green", primarySoft: "lightgreen", surface: "white", text: "black", textMuted: "gray", border: "gray" },
  spacing: { xs: 4, sm: 8, md: 16 },
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

const viewport = {
  west: 79.8,
  south: 6.8,
  east: 80,
  north: 7,
  zoom: 12,
};
const emptyIncidentPage = { items: [], nextCursor: null };
const emptyEventPage = { type: "FeatureCollection" as const, features: [], nextCursor: null };

function renderScreen(): TestRenderer.ReactTestRenderer {
  return TestRenderer.create(
    <CitizenIncidentDiscoveryScreen
      accessToken="token"
      onBack={vi.fn()}
      onReportIncident={vi.fn()}
      onOpenEvent={vi.fn()}
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
  vi.mocked(listIncidentCategories).mockResolvedValue([]);
  vi.mocked(getPublicIncident).mockResolvedValue(undefined as never);
  vi.mocked(getPublicCleanupEvent).mockResolvedValue(undefined as never);
  vi.mocked(listPublicIncidents).mockResolvedValue(emptyIncidentPage);
  vi.mocked(listNearbyPublicIncidents).mockResolvedValue(emptyIncidentPage);
  vi.mocked(listPublicCleanupEventMap).mockResolvedValue(emptyEventPage);
  vi.mocked(listNearbyCleanupEventMap).mockResolvedValue(emptyEventPage);
});

describe("mobile citizen map scenarios", () => {
  test("weak-network failure remains retryable and resolves to an empty state", async () => {
    vi.mocked(listPublicIncidents)
      .mockRejectedValueOnce(new Error("weak network"))
      .mockResolvedValue(emptyIncidentPage);
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
      await button(renderer!, "Refresh results").props.onPress();
    });
    expect(textContent(renderer!)).toContain("No incidents found");
    expect(listPublicIncidents).toHaveBeenCalledTimes(2);
  });

  test("granted foreground location performs one bounded nearby search", async () => {
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
      await button(renderer!, "Find activity near me").props.onPress();
    });

    expect(listNearbyPublicIncidents).toHaveBeenCalledWith(
      "token",
      expect.objectContaining({ latitude: 6.9271, longitude: 79.8612, radiusMeters: 5_000, limit: 50 }),
      expect.any(AbortSignal),
    );
    expect(listNearbyCleanupEventMap).toHaveBeenCalledWith(
      "token",
      expect.objectContaining({ latitude: 6.9271, longitude: 79.8612, radiusMeters: 5_000, limit: 50 }),
      expect.any(AbortSignal),
    );
    expect(textContent(renderer!)).toContain("No incidents found");
  });

  test("marker selection and activity filters keep the map and list synchronized", async () => {
    const incident = {
      id: "incident-mobile",
      title: "Mobile incident",
      category: { id: "category-1", name: "Waste", description: null },
      severity: "HIGH" as const,
      status: "ACTIVE" as const,
      latitude: 6.91,
      longitude: 79.86,
      addressText: null,
      reportedAt: "2026-08-20T00:00:00.000Z",
      falseReviewCount: 0,
      isOwnReport: false,
    };
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
    vi.mocked(listPublicIncidents).mockResolvedValue({ items: [incident], nextCursor: null });
    vi.mocked(listPublicCleanupEventMap).mockResolvedValue({
      type: "FeatureCollection",
      features: [event],
      nextCursor: null,
    });
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
    expect(map(renderer!).props.selectedMarkerId).toBe("incident-mobile");
    expect(map(renderer!).props.markers).toHaveLength(2);

    await act(async () => {
      map(renderer!).props.onMarkerSelect(event);
    });
    expect(map(renderer!).props.selectedMarkerId).toBe("event-mobile");

    const eventChip = renderer!.root.findAllByType("Pressable" as never).find((node) =>
      node.findAllByType("Text" as never).some((text) => text.children.join("") === "Events"),
    );
    await act(async () => {
      eventChip!.props.onPress();
    });
    expect(map(renderer!).props.markers).toEqual([event]);
    expect(map(renderer!).props.selectedMarkerId).toBe("event-mobile");
  });

  test("returning from background refreshes the last bounded viewport", async () => {
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
    expect(listPublicIncidents).toHaveBeenCalledTimes(1);

    await act(async () => {
      testState.foregroundRefresh?.();
      await Promise.resolve();
    });
    expect(listPublicIncidents).toHaveBeenCalledTimes(2);
    expect(vi.mocked(listPublicIncidents).mock.calls[1]?.[1]).toEqual(
      expect.objectContaining(viewport),
    );
  });
});
