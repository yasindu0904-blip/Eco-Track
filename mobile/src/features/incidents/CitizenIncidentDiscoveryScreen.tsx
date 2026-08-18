import * as Location from "expo-location";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { describeApiFailure } from "../../api/apiError";
import { Button, Notice, Screen, sharedStyles } from "../../components/ui";
import { colors, spacing } from "../../components/theme";
import {
  EcoMap,
  SRI_LANKA_MAP_BOUNDS,
  type MapLocation,
  type MapMarkerFeature,
  type MapViewport,
  type MapViewportChangeHandler,
} from "../map";
import {
  getPublicIncident,
  listIncidentCategories,
  listNearbyPublicIncidents,
  listPublicIncidents,
} from "./incident.api";
import type {
  IncidentCategory,
  IncidentDetail,
  IncidentStatus,
  PublicIncidentSummary,
} from "./incident.types";

type Props = {
  accessToken: string;
  onBack: () => void;
};

type SearchContext =
  | { mode: "viewport"; viewport: MapViewport }
  | { mode: "nearby"; location: MapLocation; radiusMeters: number };

const statuses: Array<{ value: "" | IncidentStatus; label: string }> = [
  { value: "", label: "All current" },
  { value: "ACTIVE", label: "Active" },
  { value: "CLEANUP_ORGANIZED", label: "Organized" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "EXPIRED", label: "Expired" },
];

const times = [
  { value: "", label: "Any time", milliseconds: 0 },
  { value: "24h", label: "24 hours", milliseconds: 24 * 60 * 60 * 1000 },
  { value: "7d", label: "7 days", milliseconds: 7 * 24 * 60 * 60 * 1000 },
  { value: "30d", label: "30 days", milliseconds: 30 * 24 * 60 * 60 * 1000 },
] as const;

function readable(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

function reportedAfterFor(value: (typeof times)[number]["value"]): string | undefined {
  const option = times.find((candidate) => candidate.value === value);
  return option?.milliseconds
    ? new Date(Date.now() - option.milliseconds).toISOString()
    : undefined;
}

function locationInsideSriLanka(location: MapLocation): boolean {
  return (
    location.latitude >= SRI_LANKA_MAP_BOUNDS.south &&
    location.latitude <= SRI_LANKA_MAP_BOUNDS.north &&
    location.longitude >= SRI_LANKA_MAP_BOUNDS.west &&
    location.longitude <= SRI_LANKA_MAP_BOUNDS.east
  );
}

function mergeUnique(
  current: PublicIncidentSummary[],
  incoming: PublicIncidentSummary[],
): PublicIncidentSummary[] {
  const items = new Map(current.map((item) => [item.id, item]));
  incoming.forEach((item) => items.set(item.id, item));
  return [...items.values()];
}

export function CitizenIncidentDiscoveryScreen({ accessToken, onBack }: Props) {
  const [categories, setCategories] = useState<IncidentCategory[]>([]);
  const [incidents, setIncidents] = useState<PublicIncidentSummary[]>([]);
  const [detail, setDetail] = useState<IncidentDetail>();
  const [selectedId, setSelectedId] = useState<string>();
  const [search, setSearch] = useState<SearchContext>();
  const [focusLocation, setFocusLocation] = useState<MapLocation>();
  const [status, setStatus] = useState<"" | IncidentStatus>("");
  const [categoryId, setCategoryId] = useState("");
  const [timeRange, setTimeRange] =
    useState<(typeof times)[number]["value"]>("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [mapInteracting, setMapInteracting] = useState(false);
  const [error, setError] = useState<string>();
  const requestController = useRef<AbortController | undefined>(undefined);
  const detailController = useRef<AbortController | undefined>(undefined);
  const ignoreNextFocusedViewport = useRef(false);

  useEffect(() => {
    let active = true;
    void listIncidentCategories(accessToken)
      .then((loaded) => {
        if (active) setCategories(loaded);
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(
            describeApiFailure(
              requestError,
              "Unable to load incident categories.",
            ).message,
          );
        }
      });
    return () => {
      active = false;
    };
  }, [accessToken]);

  useEffect(
    () => () => {
      requestController.current?.abort();
      detailController.current?.abort();
    },
    [],
  );

  const runSearch = useCallback(
    async (
      context: SearchContext,
      options: {
        append?: boolean;
        cursor?: string;
        externalSignal?: AbortSignal;
      } = {},
    ) => {
      requestController.current?.abort();
      const controller = new AbortController();
      requestController.current = controller;
      const abortFromExternal = () => controller.abort();
      options.externalSignal?.addEventListener("abort", abortFromExternal, {
        once: true,
      });
      if (options.externalSignal?.aborted) controller.abort();

      setLoading(true);
      setError(undefined);
      const filters = {
        limit: 50,
        cursor: options.cursor,
        status: status || undefined,
        categoryId: categoryId || undefined,
        reportedAfter: reportedAfterFor(timeRange),
      };

      try {
        const page = context.mode === "viewport"
          ? await listPublicIncidents(
              accessToken,
              { ...context.viewport, ...filters },
              controller.signal,
            )
          : await listNearbyPublicIncidents(
              accessToken,
              { ...context.location, radiusMeters: context.radiusMeters, ...filters },
              controller.signal,
            );
        if (controller.signal.aborted) return;

        setIncidents((current) =>
          options.append ? mergeUnique(current, page.items) : page.items,
        );
        setSelectedId((selected) => {
          if (options.append && selected) return selected;
          return page.items.some((incident) => incident.id === selected)
            ? selected
            : page.items[0]?.id;
        });
        setNextCursor(page.nextCursor);
      } catch (requestError) {
        if (controller.signal.aborted) return;
        setError(
          describeApiFailure(
            requestError,
            "Unable to discover cleanup activity.",
          ).message,
        );
      } finally {
        options.externalSignal?.removeEventListener("abort", abortFromExternal);
        if (requestController.current === controller) setLoading(false);
      }
    },
    [accessToken, categoryId, status, timeRange],
  );

  const handleViewportChange = useCallback<MapViewportChangeHandler>(
    (viewport, context) => {
      if (ignoreNextFocusedViewport.current) {
        ignoreNextFocusedViewport.current = false;
        return;
      }
      const nextSearch: SearchContext = { mode: "viewport", viewport };
      setSearch(nextSearch);
      return runSearch(nextSearch, { externalSignal: context.signal });
    },
    [runSearch],
  );

  useEffect(() => {
    detailController.current?.abort();
    if (!selectedId) {
      return;
    }
    const controller = new AbortController();
    detailController.current = controller;
    void Promise.resolve()
      .then(() => {
        if (controller.signal.aborted) return undefined;
        setDetail(undefined);
        setDetailLoading(true);
        return getPublicIncident(accessToken, selectedId, controller.signal);
      })
      .then((loaded) => {
        if (!controller.signal.aborted && loaded) setDetail(loaded);
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            describeApiFailure(
              requestError,
              "Unable to load incident details.",
            ).message,
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailLoading(false);
      });
    return () => controller.abort();
  }, [accessToken, selectedId]);

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

  const findNearMe = async () => {
    if (locating) return;
    setLocating(true);
    setError(undefined);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setError("Foreground location permission is required for a nearby search.");
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const location = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      if (!locationInsideSriLanka(location)) {
        setError("Your current position is outside the supported Sri Lanka map area.");
        return;
      }
      const nextSearch: SearchContext = {
        mode: "nearby",
        location,
        radiusMeters: 5_000,
      };
      ignoreNextFocusedViewport.current = true;
      setTimeout(() => {
        ignoreNextFocusedViewport.current = false;
      }, 1_500);
      setFocusLocation(location);
      setSearch(nextSearch);
      await runSearch(nextSearch);
    } catch {
      setError("Your current position is unavailable. Move the map to browse instead.");
    } finally {
      setLocating(false);
    }
  };

  const selected = incidents.find((incident) => incident.id === selectedId);

  const chip = (
    value: string,
    label: string,
    selected: boolean,
    onPress: () => void,
  ) => (
    <Pressable
      key={value || "all"}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );

  return (
    <Screen scrollEnabled={!mapInteracting}>
      <Pressable onPress={onBack}><Text style={styles.back}>← Dashboard</Text></Pressable>
      <View style={styles.intro}>
        <Text style={styles.eyebrow}>FIND CLEANUP ACTIVITY</Text>
        <Text style={styles.title}>Discover environmental incidents nearby</Text>
        <Text style={sharedStyles.sectionSubtitle}>
          Browse the visible map or request foreground location once for a five-kilometre search.
        </Text>
      </View>

      <Button
        label={locating ? "Finding your location…" : "Find incidents near me"}
        loading={locating}
        onPress={() => void findNearMe()}
      />
      <Button
        label="Refresh results"
        variant="secondary"
        disabled={!search || loading}
        onPress={() => search && void runSearch(search)}
      />

      <View style={sharedStyles.card}>
        <Text style={sharedStyles.sectionTitle}>Filters</Text>
        <Text style={styles.filterLabel}>STATUS</Text>
        <View style={styles.chips}>
          {statuses.map((option) => chip(option.value, option.label, status === option.value, () => setStatus(option.value)))}
        </View>
        <Text style={styles.filterLabel}>CATEGORY</Text>
        <View style={styles.chips}>
          {chip("", "All categories", categoryId === "", () => setCategoryId(""))}
          {categories.map((category) => chip(category.id, category.name, categoryId === category.id, () => setCategoryId(category.id)))}
        </View>
        <Text style={styles.filterLabel}>REPORTED</Text>
        <View style={styles.chips}>
          {times.map((option) => chip(option.value, option.label, timeRange === option.value, () => setTimeRange(option.value)))}
        </View>
        <Button
          label="Apply filters"
          disabled={!search || loading}
          onPress={() => search && void runSearch(search)}
        />
      </View>

      {error ? <Notice tone="error" message={error} /> : null}

      <View style={sharedStyles.spacedRow}>
        <View>
          <Text style={styles.eyebrow}>{search?.mode === "nearby" ? "WITHIN 5 KM" : "VISIBLE MAP AREA"}</Text>
          <Text style={styles.count}>{loading ? "Loading…" : `${incidents.length} found`}</Text>
        </View>
        {loading ? <ActivityIndicator color={colors.primary} /> : null}
      </View>

      <EcoMap
        markers={markers}
        selectedMarkerId={selectedId}
        focusLocation={focusLocation}
        showListFallback={false}
        height={430}
        accessibleLabel="Citizen cleanup activity discovery map"
        onMarkerSelect={(marker) => setSelectedId(marker.properties.id)}
        onViewportChange={handleViewportChange}
        onInteractionChange={setMapInteracting}
      />

      {!loading && incidents.length === 0 ? (
        <View style={sharedStyles.card}>
          <Text style={sharedStyles.sectionTitle}>No incidents found</Text>
          <Text style={sharedStyles.sectionSubtitle}>Move the map, widen the filters, or refresh the search.</Text>
        </View>
      ) : incidents.map((incident) => (
        <Pressable
          key={incident.id}
          accessibilityRole="button"
          onPress={() => setSelectedId(incident.id)}
          style={[sharedStyles.card, styles.incidentCard, incident.id === selectedId && styles.incidentCardSelected]}
        >
          <Text style={styles.category}>{incident.category.name}</Text>
          <Text style={styles.incidentTitle}>{incident.title}</Text>
          <Text style={styles.meta}>{readable(incident.severity)} · {readable(incident.status)}</Text>
        </Pressable>
      ))}

      {nextCursor && search ? (
        <Button
          label="Load more"
          variant="secondary"
          loading={loading}
          onPress={() => void runSearch(search, { append: true, cursor: nextCursor })}
        />
      ) : null}

      {selected ? (
        <View style={[sharedStyles.card, styles.detail]}>
          <Text style={styles.category}>{selected.category.name}</Text>
          <Text style={sharedStyles.sectionTitle}>{selected.title}</Text>
          <Text style={sharedStyles.sectionSubtitle}>
            {selected.addressText ?? `${selected.latitude.toFixed(5)}, ${selected.longitude.toFixed(5)}`}
          </Text>
          {detailLoading ? <ActivityIndicator color={colors.primary} /> : detail ? (
            <>
              <View style={sharedStyles.divider} />
              <Text style={styles.description}>{detail.description}</Text>
              <View style={sharedStyles.spacedRow}><Text style={styles.detailLabel}>STATUS</Text><Text style={styles.detailValue}>{readable(detail.status)}</Text></View>
              <View style={sharedStyles.spacedRow}><Text style={styles.detailLabel}>SEVERITY</Text><Text style={styles.detailValue}>{readable(detail.severity)}</Text></View>
              <View style={sharedStyles.spacedRow}><Text style={styles.detailLabel}>PUBLIC FALSE COUNT</Text><Text style={styles.detailValue}>{selected.falseReviewCount}</Text></View>
            </>
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { color: colors.primary, fontWeight: "800", paddingVertical: 8 },
  intro: { gap: spacing.xs, paddingVertical: spacing.md },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: "900", letterSpacing: 1.2 },
  title: { color: colors.text, fontSize: 34, fontWeight: "900" },
  count: { color: colors.text, fontSize: 20, fontWeight: "900", marginTop: 4 },
  filterLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: { minHeight: 38, justifyContent: "center", paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: 9, backgroundColor: colors.surface },
  chipSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { color: colors.textMuted, fontSize: 12, fontWeight: "800" },
  chipTextSelected: { color: colors.primary },
  incidentCard: { borderRadius: 10 },
  incidentCardSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  category: { color: colors.primary, fontSize: 11, fontWeight: "900" },
  incidentTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  meta: { color: colors.textMuted, fontSize: 13 },
  detail: { borderRadius: 10 },
  description: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
  detailLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "900" },
  detailValue: { color: colors.text, fontSize: 14, fontWeight: "900" },
});
