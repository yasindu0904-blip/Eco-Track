import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import * as Location from "expo-location";

import { describeApiFailure } from "../../api/apiError";
import { Button, Notice, PageHeader, Screen, sharedStyles } from "../../components/ui";
import { colors } from "../../components/theme";
import { getPublicCleanupEvent, listNearbyCleanupEventMap, listPublicCleanupEventMap } from "../cleanupEvents/cleanupEvent.api";
import type { CleanupEventMapFeature, CleanupEventPublicDetail } from "../cleanupEvents/cleanupEvent.types";
import {
  COLOMBO_MAP_CENTER,
  EcoMap,
  SRI_LANKA_MAP_BOUNDS,
  type MapLocation,
  type MapViewport,
  type MapViewportChangeHandler,
  useRefreshOnForeground,
} from "../map";

type Props = {
  accessToken: string;
  onBack: () => void;
  onReportIncident: () => void;
  onOpenEvent: (eventId: string) => void;
};

type SearchContext =
  | { mode: "viewport"; viewport: MapViewport }
  | { mode: "nearby"; location: MapLocation; radiusMeters: number };

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
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [mapInteracting, setMapInteracting] = useState(false);
  const [error, setError] = useState<string>();
  const requestController = useRef<AbortController | undefined>(undefined);
  const detailController = useRef<AbortController | undefined>(undefined);
  const ignoreNextFocusedViewport = useRef(false);
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
      options: { externalSignal?: AbortSignal } = {},
    ) => {
      requestController.current?.abort();
      const controller = new AbortController();
      requestController.current = controller;
      const abortFromExternal = () => controller.abort();
      options.externalSignal?.addEventListener("abort", abortFromExternal, { once: true });
      if (options.externalSignal?.aborted) controller.abort();

      setLoading(true);
      setError(undefined);
      try {
        const loadedEvents: CleanupEventMapFeature[] = [];
        let cursor: string | undefined;
        const seenCursors = new Set<string>();
        let shouldLoad = true;

        while (shouldLoad) {
          const page = context.mode === "viewport"
            ? await listPublicCleanupEventMap(accessToken, {
                ...context.viewport,
                limit: 50,
                cursor,
              }, controller.signal)
            : await listNearbyCleanupEventMap(accessToken, {
                ...context.location,
                radiusMeters: context.radiusMeters,
                limit: 50,
                cursor,
              }, controller.signal);
          if (controller.signal.aborted) return;

          loadedEvents.push(...page.features);
          const nextCursor = page.nextCursor ?? undefined;
          if (nextCursor && !seenCursors.has(nextCursor)) {
            seenCursors.add(nextCursor);
            cursor = nextCursor;
          } else {
            shouldLoad = false;
          }
        }

        setEvents(loadedEvents);
        const currentId = selectedIdRef.current;
        selectEvent(currentId && loadedEvents.some((event) => event.properties.id === currentId)
          ? currentId
          : undefined);
      } catch (requestError) {
        if (controller.signal.aborted) return;
        setError(describeApiFailure(requestError, "Unable to discover cleanup events.").message);
      } finally {
        options.externalSignal?.removeEventListener("abort", abortFromExternal);
        if (requestController.current === controller) setLoading(false);
      }
    },
    [accessToken, selectEvent],
  );

  const handleViewportChange = useCallback<MapViewportChangeHandler>(
    (viewport, context) => {
      if (ignoreNextFocusedViewport.current) return;
      const nextSearch: SearchContext = { mode: "viewport", viewport };
      setSearch(nextSearch);
      return runSearch(nextSearch, { externalSignal: context.signal });
    },
    [runSearch],
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
      const nextSearch: SearchContext = { mode: "nearby", location, radiusMeters: 2_000 };
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

  const selectedEvent = events.find((event) => event.properties.id === selectedId);

  return (
    <Screen scrollEnabled={!mapInteracting}>
      <PageHeader
        eyebrow="Community map"
        title="Find cleanup activity"
        subtitle="Browse published cleanup events or request your location once for a two-kilometre search."
        onBack={onBack}
        backLabel="Dashboard"
      />

      <Button label={locating ? "Finding your location..." : "Use my location"} loading={locating} onPress={() => void findNearMe()} />
      <Button label="Refresh events" variant="secondary" disabled={!search || loading} onPress={() => search && void runSearch(search)} />
      <Button label="Report an environmental incident" variant="secondary" onPress={onReportIncident} />

      {error ? <Notice tone="error" message={error} /> : null}
      {loading ? (
        <Notice
          tone="info"
          message={`Loading published cleanup events${search?.mode === "nearby" ? " within 2 km" : " for the current map view"}. Visible results may change until loading is complete.`}
        />
      ) : null}

      <EcoMap
        markers={events}
        selectedMarkerId={selectedId}
        focusLocation={focusLocation}
        selectedLocation={focusLocation ?? COLOMBO_MAP_CENTER}
        searchRadiusMeters={search?.mode === "nearby" ? 2_000 : undefined}
        showListFallback={false}
        showCurrentLocation={false}
        height={430}
        accessibleLabel="Published cleanup event discovery map"
        onMarkerSelect={(marker) => selectEvent(marker.properties.id)}
        markerActionLabel={(marker) => marker.properties.isJoined
          ? `View event details: ${marker.properties.title}`
          : `Join event: ${marker.properties.title}`}
        onMarkerAction={(marker) => onOpenEvent(marker.properties.id)}
        onViewportChange={handleViewportChange}
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

      {!loading && events.length === 0 ? (
        <View style={sharedStyles.card}>
          <Text style={sharedStyles.sectionTitle}>No published cleanup events found</Text>
          <Text style={sharedStyles.sectionSubtitle}>Move the map or refresh the search.</Text>
        </View>
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
});
