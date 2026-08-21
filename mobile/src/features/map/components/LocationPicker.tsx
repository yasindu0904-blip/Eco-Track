import { useEffect, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { colors } from "../../../components/theme";
import {
  COLOMBO_MAP_CENTER,
  isWithinSriLankaBounds,
} from "../map.constants";
import type { MapLocation } from "../map.types";
import { EcoMap } from "./EcoMap";

export interface LocationPickerProps {
  value?: MapLocation | null;
  initialValue?: MapLocation;
  disabled?: boolean;
  confirmLabel?: string;
  onChange?: (location: MapLocation) => void;
  onConfirm: (location: MapLocation) => void;
  onMapInteractionChange?: (isInteracting: boolean) => void;
}

export function LocationPicker({
  value,
  initialValue = COLOMBO_MAP_CENTER,
  disabled = false,
  confirmLabel = "Confirm this location",
  onChange,
  onConfirm,
  onMapInteractionChange,
}: LocationPickerProps) {
  const [internalLocation, setInternalLocation] =
    useState<MapLocation>(initialValue);
  const selectedLocation = value ?? internalLocation;
  const [latitudeText, setLatitudeText] = useState(
    selectedLocation.latitude.toFixed(6),
  );
  const [longitudeText, setLongitudeText] = useState(
    selectedLocation.longitude.toFixed(6),
  );
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );

  useEffect(() => {
    setLatitudeText(selectedLocation.latitude.toFixed(6));
    setLongitudeText(selectedLocation.longitude.toFixed(6));
  }, [selectedLocation.latitude, selectedLocation.longitude]);

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
    setLatitudeText(location.latitude.toFixed(6));
    setLongitudeText(location.longitude.toFixed(6));
    setValidationMessage(null);
    onChange?.(location);
  };

  const applyCoordinates = () => {
    const latitude = Number(latitudeText);
    const longitude = Number(longitudeText);
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
        initialCenter={selectedLocation}
        initialZoom={14}
        selectedLocation={selectedLocation}
        selectionEnabled={!disabled}
        selectionMode="center"
        height={420}
        accessibleLabel="Choose and confirm an EcoTrack location"
        onLocationSelect={selectLocation}
        onInteractionChange={onMapInteractionChange}
      />

      <View style={styles.controls}>
        <Text style={styles.eyebrow}>Selected coordinates</Text>
        <Text style={styles.coordinates}>
          {selectedLocation.latitude.toFixed(6)},{" "}
          {selectedLocation.longitude.toFixed(6)}
        </Text>
        <Text style={styles.helper}>API order: latitude, longitude</Text>

        <View style={styles.inputRow}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Latitude</Text>
            <TextInput
              value={latitudeText}
              style={styles.input}
              editable={!disabled}
              keyboardType="numbers-and-punctuation"
              accessibilityLabel="Latitude"
              onChangeText={setLatitudeText}
              onSubmitEditing={applyCoordinates}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Longitude</Text>
            <TextInput
              value={longitudeText}
              style={styles.input}
              editable={!disabled}
              keyboardType="numbers-and-punctuation"
              accessibilityLabel="Longitude"
              onChangeText={setLongitudeText}
              onSubmitEditing={applyCoordinates}
            />
          </View>
        </View>

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
          disabled={disabled}
          onPress={confirmLocation}
        >
          <Text style={styles.confirmButtonText}>{confirmLabel}</Text>
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
  coordinates: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
  },
  helper: {
    marginTop: -5,
    color: colors.textMuted,
    fontSize: 12,
  },
  inputRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  inputGroup: {
    flex: 1,
    gap: 6,
  },
  inputLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  input: {
    minHeight: 46,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
    color: colors.text,
    backgroundColor: colors.surface,
    fontSize: 14,
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
