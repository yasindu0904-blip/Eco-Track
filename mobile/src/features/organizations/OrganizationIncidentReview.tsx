import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { describeApiFailure } from "../../api/apiError";
import { Notice, sharedStyles } from "../../components/ui";
import { colors, spacing } from "../../components/theme";
import {
  EcoMap,
  type MapBoundaryFeatureCollection,
  type MapMarkerFeature,
  type MapViewportChangeHandler,
} from "../map";
import {
  listOrganizationIncidents,
  listOrganizationServiceAreaBoundaries,
} from "./organizationIncidentReview.api";
import type { OrganizationIncidentSummary } from "./organizationIncidentReview.types";

type Props = {
  accessToken: string;
  organizationId: string;
  onMapInteractionChange: (interacting: boolean) => void;
};

const statuses = [
  { value: "", label: "All current" },
  { value: "ACTIVE", label: "Active" },
  { value: "CLEANUP_ORGANIZED", label: "Organized" },
  { value: "RESOLVED", label: "Resolved" },
] as const;

function readable(value: string): string {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

export function OrganizationIncidentReview({
  accessToken,
  organizationId,
  onMapInteractionChange,
}: Props) {
  const [boundaries, setBoundaries] =
    useState<MapBoundaryFeatureCollection>();
  const [incidents, setIncidents] = useState<OrganizationIncidentSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    void listOrganizationServiceAreaBoundaries(accessToken, organizationId)
      .then(setBoundaries)
      .catch((requestError: unknown) =>
        setError(
          describeApiFailure(
            requestError,
            "Unable to load organization service areas.",
          ).message,
        ),
      );
  }, [accessToken, organizationId]);

  const loadViewport = useCallback<MapViewportChangeHandler>(
    async (viewport, context) => {
      setLoading(true);
      setError(undefined);
      try {
        const page = await listOrganizationIncidents(
          accessToken,
          organizationId,
          viewport,
          context.signal,
          status || undefined,
        );
        if (!context.signal.aborted) {
          setIncidents(page.items);
          setSelectedId((current) =>
            page.items.some((item) => item.id === current)
              ? current
              : page.items[0]?.id,
          );
        }
      } catch (requestError) {
        if (!context.signal.aborted) {
          setError(
            describeApiFailure(
              requestError,
              "Unable to load incidents in this map area.",
            ).message,
          );
        }
      } finally {
        if (!context.signal.aborted) setLoading(false);
      }
    },
    [accessToken, organizationId, status],
  );

  const markers = useMemo<MapMarkerFeature[]>(
    () => incidents.map((incident) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [incident.longitude, incident.latitude],
      },
      properties: {
        id: incident.id,
        kind: "INCIDENT",
        title: incident.title,
        status: readable(incident.status),
        category: incident.category.name,
        occurredAt: incident.reportedAt,
      },
    })),
    [incidents],
  );
  const selected = incidents.find((incident) => incident.id === selectedId);

  return (
    <View style={styles.container}>
      <View style={sharedStyles.spacedRow}>
        <View>
          <Text style={styles.eyebrow}>COVERED INCIDENTS</Text>
          <Text style={styles.count}>{incidents.length} in view</Text>
        </View>
        {loading ? <ActivityIndicator color={colors.primary} /> : null}
      </View>

      <View style={styles.filters}>
        {statuses.map((option) => (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: status === option.value }}
            onPress={() => setStatus(option.value)}
            style={[
              styles.filter,
              status === option.value && styles.filterSelected,
            ]}
          >
            <Text
              style={[
                styles.filterText,
                status === option.value && styles.filterTextSelected,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {error ? <Notice tone="error" message={error} /> : null}

      <EcoMap
        key={status || "all-current"}
        markers={markers}
        boundaries={boundaries}
        selectedMarkerId={selectedId}
        showListFallback={false}
        height={430}
        accessibleLabel="Organization incident review map"
        onMarkerSelect={(marker) => setSelectedId(marker.properties.id)}
        onViewportChange={loadViewport}
        onInteractionChange={onMapInteractionChange}
      />

      {incidents.length === 0 && !loading ? (
        <View style={sharedStyles.card}>
          <Text style={sharedStyles.sectionTitle}>No covered incidents in this view</Text>
          <Text style={sharedStyles.sectionSubtitle}>
            Use the map focus control to return to your service areas.
          </Text>
        </View>
      ) : (
        incidents.map((incident) => (
          <Pressable
            key={incident.id}
            accessibilityRole="button"
            onPress={() => setSelectedId(incident.id)}
            style={[
              sharedStyles.card,
              styles.incidentCard,
              incident.id === selectedId && styles.incidentCardSelected,
            ]}
          >
            <Text style={styles.category}>{incident.category.name}</Text>
            <Text style={styles.incidentTitle}>{incident.title}</Text>
            <Text style={styles.meta}>
              {readable(incident.severity)} severity · {readable(incident.status)}
            </Text>
          </Pressable>
        ))
      )}

      {selected ? (
        <View style={[sharedStyles.card, styles.detail]}>
          <Text style={sharedStyles.sectionTitle}>{selected.title}</Text>
          <Text style={sharedStyles.sectionSubtitle}>
            {selected.addressText ?? `${selected.latitude.toFixed(5)}, ${selected.longitude.toFixed(5)}`}
          </Text>
          <View style={sharedStyles.divider} />
          <View style={sharedStyles.spacedRow}>
            <Text style={styles.detailLabel}>YOUR REVIEW</Text>
            <Text style={styles.detailValue}>
              {selected.currentReviewStatus
                ? readable(selected.currentReviewStatus)
                : "Not reviewed"}
            </Text>
          </View>
          <View style={sharedStyles.spacedRow}>
            <Text style={styles.detailLabel}>PUBLIC FALSE COUNT</Text>
            <Text style={styles.detailValue}>{selected.falseReviewCount}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  count: { color: colors.text, fontSize: 18, fontWeight: "900", marginTop: 4 },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  filter: {
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  filterSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  filterText: { color: colors.textMuted, fontSize: 12, fontWeight: "800" },
  filterTextSelected: { color: colors.primary },
  incidentCard: { borderRadius: 8 },
  incidentCardSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  category: { color: colors.primary, fontSize: 11, fontWeight: "900" },
  incidentTitle: { color: colors.text, fontSize: 17, fontWeight: "900" },
  meta: { color: colors.textMuted, fontSize: 13 },
  detail: { borderRadius: 8 },
  detailLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "900" },
  detailValue: { color: colors.text, fontSize: 14, fontWeight: "900" },
});
