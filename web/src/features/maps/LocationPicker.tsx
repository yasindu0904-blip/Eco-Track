import { useState } from "react";

import {
  COLOMBO_MAP_CENTER,
  isWithinSriLankaBounds,
} from "./map.constants";
import type { MapLocation } from "./map.types";
import { EcoMap } from "./EcoMap";

export interface LocationPickerProps {
  value?: MapLocation | null;
  initialValue?: MapLocation;
  disabled?: boolean;
  confirmLabel?: string;
  onChange?: (location: MapLocation) => void;
  onConfirm: (location: MapLocation) => void;
}

export function LocationPicker({
  value,
  initialValue = COLOMBO_MAP_CENTER,
  disabled = false,
  confirmLabel = "Confirm this location",
  onChange,
  onConfirm,
}: LocationPickerProps) {
  const [internalLocation, setInternalLocation] =
    useState<MapLocation>(initialValue);
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );
  const selectedLocation = value ?? internalLocation;

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

  const applyCoordinates = (form: HTMLFormElement) => {
    const formData = new FormData(form);
    const latitude = Number(formData.get("latitude"));
    const longitude = Number(formData.get("longitude"));
    const location = { latitude, longitude };

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      !isWithinSriLankaBounds(location)
    ) {
      setValidationMessage(
        "Enter coordinates inside the supported Sri Lanka map area.",
      );
      return;
    }

    selectLocation(location);
  };

  return (
    <section className="eco-location-picker">
      <EcoMap
        initialCenter={selectedLocation}
        initialZoom={14}
        selectedLocation={selectedLocation}
        selectionEnabled={!disabled}
        selectionMode="center"
        height={420}
        accessibleLabel="Choose and confirm an EcoTrack location"
        onLocationSelect={selectLocation}
      />

      <div className="eco-location-picker-controls">
        <div>
          <span className="eco-location-picker-label">Selected coordinates</span>
          <strong>
            {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
          </strong>
          <small>API order: latitude, longitude</small>
        </div>

        <form
          className="eco-coordinate-form"
          onSubmit={(event) => {
            event.preventDefault();
            applyCoordinates(event.currentTarget);
          }}
        >
          <label>
            Latitude
            <input
              key={`latitude-${selectedLocation.latitude}`}
              name="latitude"
              type="number"
              min="-90"
              max="90"
              step="any"
              defaultValue={selectedLocation.latitude}
              disabled={disabled}
            />
          </label>
          <label>
            Longitude
            <input
              key={`longitude-${selectedLocation.longitude}`}
              name="longitude"
              type="number"
              min="-180"
              max="180"
              step="any"
              defaultValue={selectedLocation.longitude}
              disabled={disabled}
            />
          </label>
        </form>

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
          {confirmLabel}
        </button>
      </div>
    </section>
  );
}
