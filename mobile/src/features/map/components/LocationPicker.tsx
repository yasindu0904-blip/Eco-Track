import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { colors } from "../../../components/theme";
import {
  COLOMBO_MAP_CENTER,
  isWithinSriLankaBounds,
} from "../map.constants";
import type { MapLocation, MapMarkerFeature } from "../map.types";
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
  onMapInteractionChange?: (isInteracting: boolean) => void;
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
  onMapInteractionChange,
}: LocationPickerProps) {
  const [internalLocation, setInternalLocation] =
    useState<MapLocation>(initialValue);
  const selectedLocation = value ?? internalLocation;
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
    <View style={styles.shell}>
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
        onInteractionChange={onMapInteractionChange}
      />

      <View style={styles.controls}>
        <Text style={[styles.eyebrow, confirmed && styles.confirmedEyebrow]}>
          {confirmed ? "Location confirmed" : "Location selection"}
        </Text>
        <Text style={styles.statusTitle}>
          {confirmed ? "Ready to save" : "Choose a point on the map"}
        </Text>
        <Text style={styles.helper}>
          {confirmed
            ? "Use the form's save button to keep this location."
            : "Tap the map, then confirm the event location."}
        </Text>

        {referenceMarker && referenceLocation ? (
          <Pressable
            style={({ pressed }) => [
              styles.focusButton,
              pressed && styles.buttonPressed,
              disabled && styles.buttonDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel={focusReferenceLabel}
            disabled={disabled}
            onPress={() => setFocusRequest({
              referenceId: referenceMarker.properties.id,
              location: { ...referenceLocation },
            })}
          >
            <Text style={styles.focusButtonText}>{focusReferenceLabel}</Text>
          </Pressable>
        ) : null}

        {validationMessage && (
          <Text
            style={styles.error}
            accessibilityLiveRegion="assertive"
          >
            {validationMessage}
          </Text>
        )}

        <Pressable
          style={({ pressed }) => [
            styles.confirmButton,
            pressed && styles.buttonPressed,
            disabled && styles.buttonDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel={confirmLabel}
          disabled={disabled}
          onPress={confirmLocation}
        >
          <Text style={styles.confirmButtonText}>
            {confirmed ? "Location confirmed" : confirmLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    overflow: "hidden",
    borderRadius: 22,
    backgroundColor: colors.surface,
  },
  controls: {
    gap: 10,
    padding: 18,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  eyebrow: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  statusTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
  },
  confirmedEyebrow: {
    color: colors.primary,
  },
  helper: {
    marginTop: -5,
    color: colors.textMuted,
    fontSize: 12,
  },
  focusButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 11,
    backgroundColor: colors.surface,
  },
  focusButtonText: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: "800",
  },
  confirmButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: colors.primaryDark,
  },
  confirmButtonText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: "800",
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 19,
  },
  buttonPressed: {
    opacity: 0.72,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
