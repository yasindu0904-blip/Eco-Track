import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "../../components/theme";
import type { MapLocation } from "./map.types";
import { LocationPicker } from "./components/LocationPicker";

export function MapPreviewApp() {
  const [confirmedLocation, setConfirmedLocation] =
    useState<MapLocation | null>(null);
  const [mapInteracting, setMapInteracting] = useState(false);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        scrollEnabled={!mapInteracting}
      >
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>MAP-01 development preview</Text>
          <Text style={styles.title}>Choose a location</Text>
          <Text style={styles.description}>
            Move the map beneath the fixed black pin, use GPS, or enter
            coordinates manually.
          </Text>
        </View>

        <LocationPicker
          onConfirm={setConfirmedLocation}
          onMapInteractionChange={setMapInteracting}
        />

        {confirmedLocation && (
          <View style={styles.confirmation}>
            <Text style={styles.confirmationTitle}>Location confirmed</Text>
            <Text style={styles.confirmationCoordinates}>
              {confirmedLocation.latitude.toFixed(6)}, {" "}
              {confirmedLocation.longitude.toFixed(6)}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  content: {
    gap: spacing.lg,
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  heading: {
    gap: spacing.sm,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "900",
  },
  description: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  confirmation: {
    gap: spacing.xs,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: 14,
    backgroundColor: colors.successSoft,
  },
  confirmationTitle: {
    color: colors.success,
    fontSize: 15,
    fontWeight: "800",
  },
  confirmationCoordinates: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
});
