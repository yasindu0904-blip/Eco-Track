import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, test, vi } from "vitest";

import { LocationPicker } from "./LocationPicker";

vi.mock("react-native", () => ({
  Pressable: "Pressable",
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: "Text",
  TextInput: "TextInput",
  View: "View",
}));

vi.mock("./EcoMap", () => ({ EcoMap: "EcoMap" }));

describe("manual mobile map location fallback", () => {
  test("applies and confirms coordinates without using location services", async () => {
    const onConfirm = vi.fn();
    let renderer: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(<LocationPicker onConfirm={onConfirm} />);
    });

    const latitude = renderer!.root.findByProps({ accessibilityLabel: "Latitude" });
    const longitude = renderer!.root.findByProps({ accessibilityLabel: "Longitude" });

    await act(async () => {
      latitude.props.onChangeText("7.123456");
      longitude.props.onChangeText("80.123456");
    });
    await act(async () => {
      longitude.props.onSubmitEditing();
    });
    await act(async () => {
      renderer!.root.findByProps({ accessibilityRole: "button" }).props.onPress();
    });

    expect(onConfirm).toHaveBeenCalledWith({ latitude: 7.123456, longitude: 80.123456 });
  });

  test("keeps invalid manual coordinates recoverable", async () => {
    let renderer: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(<LocationPicker onConfirm={vi.fn()} />);
    });

    await act(async () => {
      renderer!.root.findByProps({ accessibilityLabel: "Latitude" }).props.onChangeText("0");
      renderer!.root.findByProps({ accessibilityLabel: "Longitude" }).props.onChangeText("0");
    });
    await act(async () => {
      renderer!.root.findByProps({ accessibilityLabel: "Longitude" }).props.onSubmitEditing();
    });

    expect(
      renderer!.root.findByProps({ accessibilityLiveRegion: "assertive" }).children.join(""),
    ).toBe("Enter coordinates inside the supported Sri Lanka map area.");
    expect(renderer!.root.findAll((node) =>
      node.props.accessibilityLabel === "Latitude" || node.props.accessibilityLabel === "Longitude",
    )).toHaveLength(2);
  });
});
