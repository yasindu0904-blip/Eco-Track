import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, test, vi } from "vitest";

import { LocationPicker } from "./LocationPicker";

vi.mock("react-native", () => ({
  Pressable: "Pressable",
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: "Text",
  View: "View",
}));

vi.mock("./EcoMap", () => ({ EcoMap: "EcoMap" }));

const incidentMarker = {
  type: "Feature" as const,
  geometry: { type: "Point" as const, coordinates: [79.86, 6.92] as [number, number] },
  properties: {
    id: "incident-1",
    kind: "INCIDENT" as const,
    title: "Blocked canal",
    status: "ACTIVE",
  },
};

describe("mobile map location picker", () => {
  test("focuses the reference incident and confirms a map-selected event location", async () => {
    const onConfirm = vi.fn();
    const onChange = vi.fn();
    let renderer: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(
        <LocationPicker
          initialValue={{ latitude: 6.92, longitude: 79.86 }}
          referenceMarker={incidentMarker}
          focusReferenceLabel="Focus incident"
          confirmLabel="Confirm event location"
          onChange={onChange}
          onConfirm={onConfirm}
        />,
      );
    });

    let map = renderer!.root.findByType("EcoMap" as never);
    expect(map.props.markers).toEqual([incidentMarker]);
    expect(map.props.selectionMode).toBe("point");
    expect(map.props.showCurrentLocation).toBe(false);
    expect(map.props.selectedLocation).toBeNull();

    await act(async () => {
      renderer!.root.findByProps({ accessibilityLabel: "Focus incident" }).props.onPress();
    });
    map = renderer!.root.findByType("EcoMap" as never);
    expect(map.props.focusLocation).toEqual({ latitude: 6.92, longitude: 79.86 });

    await act(async () => {
      map.props.onLocationSelect({ latitude: 7.123456, longitude: 80.123456 });
    });
    await act(async () => {
      renderer!.root.findByProps({ accessibilityLabel: "Confirm event location" }).props.onPress();
    });

    expect(onChange).toHaveBeenCalledWith({ latitude: 7.123456, longitude: 80.123456 });
    expect(onConfirm).toHaveBeenCalledWith({ latitude: 7.123456, longitude: 80.123456 });

    await act(async () => {
      renderer!.update(
        <LocationPicker
          initialValue={{ latitude: 6.92, longitude: 79.86 }}
          referenceMarker={incidentMarker}
          confirmed
          focusReferenceLabel="Focus incident"
          confirmLabel="Confirm event location"
          onChange={onChange}
          onConfirm={onConfirm}
        />,
      );
    });
    expect(renderer!.root.findAll((node) => node.children.includes("Ready to save"))).toHaveLength(1);
    expect(renderer!.root.findAll((node) => node.children.includes("Selected coordinates"))).toHaveLength(0);
  });

  test("rejects an invalid map selection without coordinate inputs", async () => {
    let renderer: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(<LocationPicker onConfirm={vi.fn()} />);
    });

    await act(async () => {
      renderer!.root.findByType("EcoMap" as never).props.onLocationSelect({
        latitude: 0,
        longitude: 0,
      });
    });

    expect(
      renderer!.root.findByProps({ accessibilityLiveRegion: "assertive" }).children.join(""),
    ).toBe("Select a location inside the supported Sri Lanka map area.");
    expect(renderer!.root.findAllByType("TextInput" as never)).toHaveLength(0);
  });
});
