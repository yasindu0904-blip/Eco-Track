// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, test, vi } from "vitest";

import type { MapMarkerFeature } from "./map.types";
import { EcoMap } from "./EcoMap";
import { LocationPicker } from "./LocationPicker";

vi.mock("./EcoMap", () => ({
  EcoMap: (props: ComponentProps<typeof EcoMap>) => (
    <div aria-label={props.accessibleLabel}>
      <output data-testid="marker-ids">
        {(props.markers ?? []).map((marker) => marker.properties.id).join(",")}
      </output>
      <output data-testid="selection-mode">{props.selectionMode}</output>
      <output data-testid="current-location">
        {String(props.showCurrentLocation)}
      </output>
      <output data-testid="focus-location">
        {props.focusLocation
          ? `${props.focusLocation.latitude},${props.focusLocation.longitude}`
          : "none"}
      </output>
      <button
        type="button"
        onClick={() => props.onLocationSelect?.({ latitude: 6.81, longitude: 79.92 })}
      >
        Select event point
      </button>
    </div>
  ),
}));

const incidentMarker: MapMarkerFeature = {
  type: "Feature",
  geometry: { type: "Point", coordinates: [79.86, 6.92] },
  properties: {
    id: "incident-1",
    kind: "INCIDENT",
    title: "Blocked canal",
    status: "ACTIVE",
  },
};

describe("LocationPicker", () => {
  test("shows only the reference incident and confirms a map-selected event location", () => {
    const onChange = vi.fn();
    const onConfirm = vi.fn();

    const view = render(
      <form aria-label="Draft form">
        <LocationPicker
          initialValue={{ latitude: 6.92, longitude: 79.86 }}
          referenceMarker={incidentMarker}
          focusReferenceLabel="Focus incident"
          confirmLabel="Confirm event location"
          onChange={onChange}
          onConfirm={onConfirm}
        />
      </form>,
    );

    expect(screen.getByTestId("marker-ids").textContent).toBe("incident-1");
    expect(screen.getByTestId("selection-mode").textContent).toBe("point");
    expect(screen.getByTestId("current-location").textContent).toBe("false");
    expect(screen.queryByLabelText("Latitude")).toBeNull();
    expect(screen.queryByLabelText("Longitude")).toBeNull();
    expect(screen.queryByText("Selected coordinates")).toBeNull();
    expect(screen.queryByText("6.920000, 79.860000")).toBeNull();
    expect(document.querySelectorAll("form")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Focus incident" }));
    expect(screen.getByTestId("focus-location").textContent).toBe("6.92,79.86");

    fireEvent.click(screen.getByRole("button", { name: "Select event point" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm event location" }));

    expect(onChange).toHaveBeenCalledWith({ latitude: 6.81, longitude: 79.92 });
    expect(onConfirm).toHaveBeenCalledWith({ latitude: 6.81, longitude: 79.92 });

    view.rerender(
      <form aria-label="Draft form">
        <LocationPicker
          initialValue={{ latitude: 6.92, longitude: 79.86 }}
          referenceMarker={incidentMarker}
          confirmed
          focusReferenceLabel="Focus incident"
          confirmLabel="Confirm event location"
          onChange={onChange}
          onConfirm={onConfirm}
        />
      </form>,
    );
    expect(screen.getByText("Ready to save")).toBeTruthy();
    expect(screen.getByText("Use the form's save button to keep this location.")).toBeTruthy();
  });
});
