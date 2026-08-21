import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import * as Location from "expo-location";

import { describeApiFailure } from "../../api/apiError";
import { Button, Notice, PageHeader, Screen, sharedStyles } from "../../components/ui";
import { colors } from "../../components/theme";
import { getPublicCleanupEvent, listNearbyCleanupEventMap } from "../cleanupEvents/cleanupEvent.api";
import type { CleanupEventMapFeature, CleanupEventPublicDetail } from "../cleanupEvents/cleanupEvent.types";
import {
  EcoMap,
  SRI_LANKA_MAP_BOUNDS,
  type MapLocation,
  useRefreshOnForeground,
} from "../map";

type Props = {
  accessToken: string;
  onBack: () => void;
  onReportIncident: () => void;
  onOpenEvent: (eventId: string) => void;
};

type SearchContext = { location: MapLocation; radiusMeters: number };

const RADIUS_OPTIONS = [2_000, 5_000, 10_000, 25_000] as const;

function readable(value: string): string {
  return value.toLowerCase().replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

function locationInsideSriLanka(location: MapLocation): boolean {
  return (
    location.latitude >= SRI_LANKA_MAP_BOUNDS.south &&
    location.latitude <= SRI_LANKA_MAP_BOUNDS.north &&
    location.longitude >= SRI_LANKA_MAP_BOUNDS.west &&
    location.longitude <= SRI_LANKA_MAP_BOUNDS.east
  );
}

export function CitizenIncidentDiscoveryScreen({
  accessToken,
  onBack,
  onReportIncident,
  onOpenEvent,
}: Props) {
  const [events, setEvents] = useState<CleanupEventMapFeature[]>([]);
  const [eventDetail, setEventDetail] = useState<CleanupEventPublicDetail>();
  const [selectedId, setSelectedId] = useState<string>();
  const [search, setSearch] = useState<SearchContext>();
  const [focusLocation, setFocusLocation] = useState<MapLocation>();
  const [radiusMeters, setRadiusMeters] = useState<number>(RADIUS_OPTIONS[0]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [mapInteracting, setMapInteracting] = useState(false);
  const [error, setError] = useState<string>();
  const requestController = useRef<AbortController | undefined>(undefined);
  const detailController = useRef<AbortController | undefined>(undefined);
  const selectedIdRef = useRef<string | undefined>(undefined);

  const selectEvent = useCallback((id?: string) => {
    selectedIdRef.current = id;
    setSelectedId(id);
  }, []);

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
      options: { append?: boolean; cursor?: string } = {},
    ) => {
      requestController.current?.abort();
      const controller = new AbortController();
      requestController.current = controller;

      setLoading(true);
      setError(undefined);
      if (!options.append) {
        setEvents([]);
        setNextCursor(null);
        setEventDetail(undefined);
        selectEvent(undefined);
      }
      try {
        const page = await listNearbyCleanupEventMap(accessToken, {
          ...context.location,
          radiusMeters: context.radiusMeters,
          limit: 50,
          cursor: options.cursor,
        }, controller.signal);
        if (controller.signal.aborted) return;

        const loadedEvents = options.append
          ? [...events, ...page.features].filter(
              (event, index, all) => all.findIndex(
                (candidate) => candidate.properties.id === event.properties.id,
              ) === index,
            )
          : page.features;
        setEvents(loadedEvents);
        setNextCursor(page.nextCursor);
        const currentId = selectedIdRef.current;
        selectEvent(currentId && loadedEvents.some((event) => event.properties.id === currentId)
          ? currentId
          : undefined);
      } catch (requestError) {
        if (controller.signal.aborted) return;
        setError(describeApiFailure(requestError, "Unable to discover cleanup events.").message);
      } finally {
        if (requestController.current === controller) setLoading(false);
      }
    },
    [accessToken, events, selectEvent],
  );

  const refreshAfterForeground = useCallback(() => {
    if (search) void runSearch(search);
  }, [runSearch, search]);
  useRefreshOnForeground(refreshAfterForeground);

  useEffect(() => {
    detailController.current?.abort();
    if (!selectedId) return;

    const controller = new AbortController();
    detailController.current = controller;
    void Promise.resolve()
      .then(() => {
        if (controller.signal.aborted) return undefined;
        setEventDetail(undefined);
        setDetailLoading(true);
        return getPublicCleanupEvent(accessToken, selectedId, controller.signal);
      })
      .then((loaded) => {
        if (!controller.signal.aborted && loaded) setEventDetail(loaded);
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) {
          setError(describeApiFailure(requestError, "Unable to load cleanup event details.").message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailLoading(false);
      });
    return () => controller.abort();
  }, [accessToken, selectedId]);

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
      const nextSearch: SearchContext = { location, radiusMeters };
      setFocusLocation(location);
      setSearch(nextSearch);
      await runSearch(nextSearch);
    } catch {
      setError("Your current position is unavailable. Move the map to browse instead.");
    } finally {
      setLocating(false);
    }
  };

  const changeRadius = (nextRadiusMeters: number) => {
    setRadiusMeters(nextRadiusMeters);
    if (!focusLocation) return;
    const nextSearch = { location: focusLocation, radiusMeters: nextRadiusMeters };
    setSearch(nextSearch);
    void runSearch(nextSearch);
  };

  const selectedEvent = events.find((event) => event.properties.id === selectedId);

  return (
    <Screen scrollEnabled={!mapInteracting}>
      <PageHeader
        eyebrow="Community map"
        title="Find cleanup activity"
        subtitle="Use your current location to find published cleanup events within a distance you choose."
        onBack={onBack}
        backLabel="Dashboard"
      />

      <Button label={locating ? "Finding your location..." : "Use my location"} loading={locating} onPress={() => void findNearMe()} />
      <Button label="Refresh events" variant="secondary" disabled={!search || loading} onPress={() => search && void runSearch(search)} />
      <Button label="Report an environmental incident" variant="secondary" onPress={onReportIncident} />

      <View style={styles.radiusCard}>
        <Text style={styles.radiusLabel}>SEARCH RADIUS</Text>
        <View style={styles.radiusOptions}>
          {RADIUS_OPTIONS.map((radius) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Search within ${radius / 1_000} km`}
              accessibilityState={{ selected: radiusMeters === radius }}
              key={radius}
              onPress={() => changeRadius(radius)}
              style={[styles.radiusOption, radiusMeters === radius && styles.radiusOptionSelected]}
            >
              <Text style={[styles.radiusOptionText, radiusMeters === radius && styles.radiusOptionTextSelected]}>{radius / 1_000} km</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.radiusSummary}>{search ? `${events.length} published event${events.length === 1 ? "" : "s"} loaded` : "Location is required before events are loaded"}</Text>
      </View>

      {error ? <Notice tone="error" message={error} /> : null}
      {loading ? (
        <Notice
          tone="info"
          message={`Loading published cleanup events within ${radiusMeters / 1_000} km.`}
        />
      ) : null}

      <EcoMap
        markers={events}
        selectedMarkerId={selectedId}
        focusLocation={focusLocation}
        selectedLocation={focusLocation}
        searchRadiusMeters={search?.radiusMeters}
        showListFallback
        listTitle={`Cleanup events within ${radiusMeters / 1_000} km`}
        showCurrentLocation={false}
        height={430}
        accessibleLabel="Published cleanup event discovery map"
        onMarkerSelect={(marker) => selectEvent(marker.properties.id)}
        markerActionLabel={(marker) => marker.properties.isJoined
          ? `View event details: ${marker.properties.title}`
          : `Join event: ${marker.properties.title}`}
        onMarkerAction={(marker) => onOpenEvent(marker.properties.id)}
        onInteractionChange={setMapInteracting}
      />

      {selectedEvent ? (
        <View style={[sharedStyles.card, styles.detail]}>
          <Text style={styles.category}>{selectedEvent.properties.organizationName}</Text>
          <Text style={sharedStyles.sectionTitle}>{selectedEvent.properties.title}</Text>
          <Text style={sharedStyles.sectionSubtitle}>{selectedEvent.properties.isJoined ? "You joined this event." : "Published cleanup event"}</Text>
          {detailLoading ? <ActivityIndicator color={colors.primary} /> : eventDetail ? <>
            <View style={sharedStyles.divider} />
            <Text style={styles.description}>{eventDetail.description}</Text>
            {eventDetail.publicInstructions ? <Text style={styles.description}>Volunteer instructions: {eventDetail.publicInstructions}</Text> : null}
            <View style={sharedStyles.spacedRow}><Text style={styles.detailLabel}>STATUS</Text><Text style={styles.detailValue}>{readable(eventDetail.lifecycleStatus)}</Text></View>
            <View style={sharedStyles.spacedRow}><Text style={styles.detailLabel}>LOCATION</Text><Text style={styles.detailValue}>{eventDetail.meetingAddress ?? eventDetail.eventAddress ?? "Map location"}</Text></View>
            <View style={sharedStyles.spacedRow}><Text style={styles.detailLabel}>SESSIONS</Text><Text style={styles.detailValue}>{eventDetail.sessions.length}</Text></View>
            <View style={sharedStyles.spacedRow}><Text style={styles.detailLabel}>PARTICIPATION</Text><Text style={styles.detailValue}>{selectedEvent.properties.isJoined ? "Joined" : "Not joined"}</Text></View>
            <Button label={selectedEvent.properties.isJoined ? "View event details" : "Join event"} onPress={() => onOpenEvent(selectedEvent.properties.id)} />
          </> : null}
        </View>
      ) : null}

      {!search ? (
        <View style={sharedStyles.card}>
          <Text style={sharedStyles.sectionTitle}>Use your location to begin</Text>
          <Text style={sharedStyles.sectionSubtitle}>EcoTrack only requests published cleanup events inside your selected radius.</Text>
        </View>
      ) : !loading && events.length === 0 ? (
        <View style={sharedStyles.card}>
          <Text style={sharedStyles.sectionTitle}>No published cleanup events found</Text>
          <Text style={sharedStyles.sectionSubtitle}>Try a larger search radius or refresh the search.</Text>
        </View>
      ) : null}

      {nextCursor && search ? (
        <Button
          label="Load more events"
          variant="secondary"
          loading={loading}
          onPress={() => void runSearch(search, { append: true, cursor: nextCursor })}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  category: { color: colors.primary, fontSize: 11, fontWeight: "900" },
  detail: { borderRadius: 10 },
  description: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
  detailLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "900" },
  detailValue: { color: colors.text, fontSize: 14, fontWeight: "900" },
  radiusCard: { gap: 10, padding: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.surface },
  radiusLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  radiusOptions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  radiusOption: { minWidth: 58, alignItems: "center", paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: colors.border, borderRadius: 999, backgroundColor: colors.surface },
  radiusOptionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  radiusOptionText: { color: colors.textMuted, fontSize: 13, fontWeight: "800" },
  radiusOptionTextSelected: { color: colors.primary },
  radiusSummary: { color: colors.textMuted, fontSize: 12 },
});
