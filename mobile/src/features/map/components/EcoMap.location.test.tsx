import TestRenderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, test, vi } from "vitest";

import * as Location from "expo-location";
import { EcoMap } from "./EcoMap";
import type { MapMarkerFeature } from "../map.types";

const scheduleViewport = vi.hoisted(() => vi.fn());

vi.mock("expo-location", () => ({
  Accuracy: { Balanced: 3 },
  PermissionStatus: { DENIED: "denied", GRANTED: "granted" },
  getCurrentPositionAsync: vi.fn(),
  requestForegroundPermissionsAsync: vi.fn(),
}));

vi.mock("react-native", () => ({
  ActivityIndicator: "ActivityIndicator",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  StyleSheet: {
    absoluteFill: {},
    create: <T,>(styles: T) => styles,
  },
  Text: "Text",
  View: "View",
}));

vi.mock("@maplibre/maplibre-react-native", async () => {
  const React = await import("react");
  return {
    Camera: React.forwardRef(() => React.createElement("Camera")),
    GeoJSONSource: React.forwardRef((props: Record<string, unknown>) =>
      React.createElement("GeoJSONSource", props)),
    Layer: "Layer",
    Map: "Map",
  };
});

vi.mock("../hooks/useDebouncedViewport", () => ({
  useDebouncedViewport: () => scheduleViewport,
}));

function textContent(renderer: TestRenderer.ReactTestRenderer): string[] {
  return renderer.root
    .findAll((node) => typeof node.children[0] === "string")
    .map((node) => node.children.join(""));
}

function currentLocationButton(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root.findByProps({ accessibilityLabel: "Use my current location" });
}

describe("EcoMap location fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("granted foreground location selects the position without starting a watcher", async () => {
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
    const onLocationSelect = vi.fn();
    let renderer: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(
        <EcoMap selectionEnabled onLocationSelect={onLocationSelect} />,
      );
    });
    await act(async () => {
      await currentLocationButton(renderer!).props.onPress();
    });

    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(Location.getCurrentPositionAsync).toHaveBeenCalledTimes(1);
    expect(onLocationSelect).toHaveBeenCalledWith({
      latitude: 6.9271,
      longitude: 79.8612,
    });
  });

  test("permission denial leaves manual map selection usable", async () => {
    vi.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({
      granted: false,
      canAskAgain: false,
      expires: "never",
      status: Location.PermissionStatus.DENIED,
    });
    const onLocationSelect = vi.fn();
    let renderer: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(
        <EcoMap selectionEnabled onLocationSelect={onLocationSelect} />,
      );
    });
    await act(async () => {
      await currentLocationButton(renderer!).props.onPress();
    });

    expect(textContent(renderer!)).toContain(
      "Location permission was denied. Move the map or enter coordinates manually.",
    );
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();

    await act(async () => {
      renderer!.root.findByType("Map" as never).props.onPress({
        nativeEvent: { lngLat: [80.123456, 7.123456] },
      });
    });
    expect(onLocationSelect).toHaveBeenCalledWith({
      latitude: 7.123456,
      longitude: 80.123456,
    });
  });

  test("location-provider failure exposes the unavailable fallback", async () => {
    vi.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({
      granted: true,
      canAskAgain: true,
      expires: "never",
      status: Location.PermissionStatus.GRANTED,
    });
    vi.mocked(Location.getCurrentPositionAsync).mockRejectedValue(
      new Error("provider unavailable"),
    );
    let renderer: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(<EcoMap selectionEnabled />);
    });
    await act(async () => {
      await currentLocationButton(renderer!).props.onPress();
    });

    expect(textContent(renderer!)).toContain(
      "Current location is unavailable. Move the map or enter coordinates manually.",
    );
  });

  test("dense marker source remains clustered and marker presses synchronize selection", async () => {
    const markers: MapMarkerFeature[] = Array.from({ length: 250 }, (_, index) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [79.86 + index * 0.000001, 6.91 + index * 0.000001],
      },
      properties: {
        id: `marker-${index}`,
        kind: "INCIDENT",
        title: `Dense incident ${index}`,
        status: "Active",
      },
    }));
    const onMarkerSelect = vi.fn();
    let renderer: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(
        <EcoMap markers={markers} showListFallback={false} onMarkerSelect={onMarkerSelect} />,
      );
    });
    const markerSource = renderer!.root.findByProps({ id: "eco-map-markers" });

    expect(markerSource.props.cluster).toBe(true);
    expect(markerSource.props.clusterRadius).toBe(48);
    expect(markerSource.props.data.features).toHaveLength(250);

    await act(async () => {
      await markerSource.props.onPress({
        nativeEvent: { features: [markers[137]] },
      });
    });
    expect(onMarkerSelect).toHaveBeenCalledWith(markers[137]);
  });

  test("wide viewport changes are blocked while bounded changes are scheduled", async () => {
    let renderer: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(<EcoMap />);
    });
    const nativeMap = renderer!.root.findByType("Map" as never);

    await act(async () => {
      nativeMap.props.onRegionDidChange({
        nativeEvent: {
          bounds: [79.5, 5.8, 82, 10],
          center: [80.7, 7.9],
          zoom: 7,
        },
      });
    });
    expect(scheduleViewport).not.toHaveBeenCalled();
    expect(textContent(renderer!)).toContain("Zoom in to load locations");

    await act(async () => {
      nativeMap.props.onRegionDidChange({
        nativeEvent: {
          bounds: [79.8, 6.8, 80, 7],
          center: [79.9, 6.9],
          zoom: 12,
        },
      });
    });
    expect(scheduleViewport).toHaveBeenCalledWith({
      west: 79.8,
      south: 6.8,
      east: 80,
      north: 7,
      zoom: 12,
    });
  });
});
