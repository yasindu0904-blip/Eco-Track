import { useState } from "react";

import {
  COLOMBO_MAP_CENTER,
  isWithinSriLankaBounds,
} from "./map.constants";
import type { MapLocation, MapMarkerFeature } from "./map.types";
import { EcoMap } from "./EcoMap";

export interface LocationPickerProps {
  value?: MapLocation | null;
  initialValue?: MapLocation;
  disabled?: boolean;
  confirmed?: boolean;
  confirmLabel?: string;
  referenceMarker?: MapMarkerFeature;
  focusReferenceLabel?: string;
  onChange?: (location: MapLocation) => void;
  onConfirm: (location: MapLocation) => void;
}

export function LocationPicker({
  value,
  initialValue = COLOMBO_MAP_CENTER,
  disabled = false,
  confirmed = false,
  confirmLabel = "Confirm this location",
  referenceMarker,
  focusReferenceLabel = "Focus reference location",
  onChange,
  onConfirm,
}: LocationPickerProps) {
  const [internalLocation, setInternalLocation] =
    useState<MapLocation>(initialValue);
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );
  const [focusRequest, setFocusRequest] = useState<{
    referenceId: string;
    location: MapLocation;
  } | null>(null);
  const [selectedReferenceId, setSelectedReferenceId] = useState<string | null>(
    null,
  );
  const selectedLocation = value ?? internalLocation;
  const referenceLocation = referenceMarker
    ? {
        latitude: referenceMarker.geometry.coordinates[1],
        longitude: referenceMarker.geometry.coordinates[0],
      }
    : null;
  const activeFocusLocation =
    referenceMarker && focusRequest?.referenceId === referenceMarker.properties.id
      ? focusRequest.location
      : null;

  const selectLocation = (location: MapLocation) => {
    if (disabled) {
      return;
    }

    if (!isWithinSriLankaBounds(location)) {
      setValidationMessage(
        "Select a location inside the supported Sri Lanka map area.",
      );
      return;
    }

    setInternalLocation(location);
    setSelectedReferenceId(referenceMarker?.properties.id ?? null);
    setValidationMessage(null);
    onChange?.(location);
  };

  const confirmLocation = () => {
    if (!isWithinSriLankaBounds(selectedLocation)) {
      setValidationMessage(
        "Select a location inside the supported Sri Lanka map area before confirming.",
      );
      return;
    }

    setValidationMessage(null);
    onConfirm(selectedLocation);
  };

  return (
    <section className="eco-location-picker">
      <EcoMap
        markers={referenceMarker ? [referenceMarker] : []}
        initialCenter={referenceLocation ?? selectedLocation}
        initialZoom={14}
        focusLocation={activeFocusLocation}
        selectedMarkerId={referenceMarker?.properties.id}
        selectedLocation={
          referenceMarker && selectedReferenceId !== referenceMarker.properties.id
            ? null
            : selectedLocation
        }
        selectionEnabled={!disabled}
        selectionMode={referenceMarker ? "point" : "center"}
        height={420}
        accessibleLabel="Choose and confirm an EcoTrack location"
        showListFallback={false}
        showCurrentLocation={!referenceMarker}
        onLocationSelect={selectLocation}
      />

      <div className="eco-location-picker-controls">
        <div className={confirmed ? "eco-location-picker-status is-confirmed" : "eco-location-picker-status"}>
          <span className="eco-location-picker-label">
            {confirmed ? "Location confirmed" : "Location selection"}
          </span>
          <strong>
            {confirmed ? "Ready to save" : "Choose a point on the map"}
          </strong>
          <small>
            {confirmed
              ? "Use the form's save button to keep this location."
              : "Tap the map, then confirm the event location."}
          </small>
        </div>

        {referenceMarker && referenceLocation && (
          <button
            type="button"
            className="eco-location-focus-reference"
            disabled={disabled}
            onClick={() => setFocusRequest({
              referenceId: referenceMarker.properties.id,
              location: { ...referenceLocation },
            })}
          >
            {focusReferenceLabel}
          </button>
        )}

        {validationMessage && (
          <p className="eco-location-picker-error" role="alert">
            {validationMessage}
          </p>
        )}

        <button
          type="button"
          className="eco-location-confirm"
          disabled={disabled}
          onClick={confirmLocation}
        >
          {confirmed ? "Location confirmed" : confirmLabel}
        </button>
      </div>
    </section>
  );
}
