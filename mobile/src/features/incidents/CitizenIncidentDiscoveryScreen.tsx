import { IncidentEvidence } from "./IncidentEvidence";
import { ListSections, PageControls } from "../../components/lists/ListControls";
import { eventSections, useListState, type EventSection } from "../../components/lists/usePagedList";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import * as Location from "expo-location";

import { describeApiFailure } from "../../api/apiError";
import {
  Button,
  Notice,
  PageHeader,
  Screen,
  sharedStyles,
} from "../../components/ui";
import { colors } from "../../components/theme";
import {
  getPublicCleanupEvent,
  listNearbyCleanupEventMap,
} from "../cleanupEvents/cleanupEvent.api";
import type {
  CleanupEventPublicDetail,
} from "../cleanupEvents/cleanupEvent.types";
import {
  AdministrativeAreaMapSearch,
  EcoMap,
  SRI_LANKA_MAP_BOUNDS,
  type MapBoundaryFeatureCollection,
  type MapLocation,
  type MapMarkerFeature,
  useRefreshOnForeground,
} from "../map";

type Props = {
  accessToken: string;
  onBack: () => void;
  onReportIncident: () => void;
  onOpenEvent: (eventId: string) => void;
};

import { getPublicIncident, listNearbyPublicIncidents } from "./incident.api";
import type { IncidentDetail } from "./incident.types";

type DiscoverySection = EventSection | "awaiting";
const discoverySections = [...eventSections, { value: "awaiting" as const, label: "Awaiting cleanup" }];

type SearchContext = { location: MapLocation; radiusMeters: number };

const RADIUS_OPTIONS = [1_000, 2_000, 3_000] as const;

function readable(value: string): string {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
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
  const [section, setSection] = useListState<DiscoverySection>("nearby-activity-v2.section", "upcoming");
  const [events, setEvents] = useListState<MapMarkerFeature[]>("nearby-activity-v2.events", []);
  const [eventDetail, setEventDetail] = useState<CleanupEventPublicDetail>();
  const [incidentDetail, setIncidentDetail] = useState<IncidentDetail>();
  const [selectedId, setSelectedId] = useState<string>();
  const [search, setSearch] = useListState<SearchContext | undefined>("nearby-activity-v2.search", undefined);
  const [focusLocation, setFocusLocation] = useListState<MapLocation | undefined>("nearby-activity-v2.focus", undefined);
  const [searchedBoundary, setSearchedBoundary] =
    useState<MapBoundaryFeatureCollection>();
  const [radiusMeters, setRadiusMeters] = useListState<number>("nearby-activity-v2.radius", 2_000);
  const [nextCursor, setNextCursor] = useListState<string | null>("nearby-activity-v2.cursor", null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [mapInteracting, setMapInteracting] = useState(false);
  const [error, setError] = useState<string>();
  const requestController = useRef<AbortController | undefined>(undefined);
  const detailController = useRef<AbortController | undefined>(undefined);
  const selectedIdRef = useRef<string | undefined>(undefined);

  const selectEvent = useCallback((id?: string) => {
    if (selectedIdRef.current === id) return;
    selectedIdRef.current = id;
    setSelectedId(id);
    setEventDetail(undefined);
    setIncidentDetail(undefined);
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
      options: { append?: boolean; cursor?: string; section?: DiscoverySection; pageIndex?: number } = {},
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
        const selectedSection = options.section ?? section;
        const query = { ...context.location, radiusMeters: context.radiusMeters, limit: 20, cursor: options.cursor };
        let page: { features: MapMarkerFeature[]; nextCursor: string | null };
        if (selectedSection === "awaiting") {
          const incidents = await listNearbyPublicIncidents(accessToken, { ...query, awaitingCleanup: true }, controller.signal);
          page = {
            nextCursor: incidents.nextCursor,
            features: incidents.items.map(incident => ({
              type: "Feature", geometry: { type: "Point", coordinates: [incident.longitude, incident.latitude] },
              properties: { id: incident.id, kind: "INCIDENT", title: incident.title, status: incident.status,
                category: incident.category.name, occurredAt: incident.reportedAt },
            })),
          };
        } else {
          page = await listNearbyCleanupEventMap(accessToken, { ...query, section: selectedSection }, controller.signal);
        }
        if (controller.signal.aborted) return;

        const loadedEvents = options.append
          ? [...events, ...page.features].filter(
              (event, index, all) =>
                all.findIndex(
                  (candidate) =>
                    candidate.properties.id === event.properties.id,
                ) === index,
            )
          : page.features;
        setEvents(loadedEvents);
        setNextCursor(page.nextCursor);

        const currentId = selectedIdRef.current;
        selectEvent(
          currentId &&
            loadedEvents.some((event) => event.properties.id === currentId)
            ? currentId
            : undefined,
        );
      } catch (requestError) {
        if (controller.signal.aborted) return;
        setError(
          describeApiFailure(requestError, "Unable to discover nearby activity.")
            .message,
        );
      } finally {
        if (requestController.current === controller) setLoading(false);
      }
    },
    [accessToken, events, selectEvent, section, setEvents, setNextCursor],
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
    void Promise.resolve().then(async () => {
      if (controller.signal.aborted) return;
      setDetailLoading(true);
      setEventDetail(undefined);
      setIncidentDetail(undefined);
      setError(undefined);
      try {
        if (section === "awaiting") {
          const incident = await getPublicIncident(accessToken, selectedId, controller.signal);
          if (!controller.signal.aborted) setIncidentDetail(incident);
        } else {
          const event = await getPublicCleanupEvent(accessToken, selectedId, controller.signal);
          if (controller.signal.aborted) return;
          setEventDetail(event);
          if (event.incidentId) {
            const incident = await getPublicIncident(accessToken, event.incidentId, controller.signal);
            if (!controller.signal.aborted) setIncidentDetail(incident);
          }
        }
      } catch (requestError: unknown) {
        if (!controller.signal.aborted) setError(describeApiFailure(requestError, "Unable to load activity details.").message);
      } finally {
        if (!controller.signal.aborted) setDetailLoading(false);
      }
    });
    return () => controller.abort();
  }, [accessToken, selectedId, section]);

  const findNearMe = async () => {
    if (locating) return;
    setLocating(true);
    setError(undefined);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setError(
          "Foreground location permission is required for a nearby search.",
        );
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
        setError(
          "Your current position is outside the supported Sri Lanka map area.",
        );
        return;
      }
      const nextSearch: SearchContext = { location, radiusMeters };
      setFocusLocation(location);
      setSearch(nextSearch);
      await runSearch(nextSearch);
    } catch {
      setError(
        "Your current position is unavailable. Move the map to browse instead.",
      );
    } finally {
      setLocating(false);
    }
  };

  const changeRadius = (nextRadiusMeters: number) => {
    setRadiusMeters(nextRadiusMeters);
    if (!focusLocation) return;
    const nextSearch = {
      location: focusLocation,
      radiusMeters: nextRadiusMeters,
    };
    setSearch(nextSearch);
    void runSearch(nextSearch);
  };

  function changeSection(value: DiscoverySection) {
    requestController.current?.abort();
    detailController.current?.abort();
    setSection(value);
    setEvents([]); setNextCursor(null); selectEvent(undefined); setEventDetail(undefined);
    if (search) void runSearch(search, { section: value });
  }

  const selectedEvent = section !== "awaiting" ? events.find(
    (event) => event.properties.id === selectedId,
  ) : undefined;

  return (
    <Screen rememberKey={"nearby:" + section} scrollEnabled={!mapInteracting}>
      <PageHeader
        eyebrow="Community map"
        title="Find cleanup activity"
        onBack={onBack}
        backLabel="Dashboard"
      />

      <Button
        label={locating ? "Finding your location..." : "Use my location"}
        loading={locating}
        onPress={() => void findNearMe()}
      />
      <Button
        label={section === "awaiting" ? "Refresh incidents" : "Refresh events"}
        variant="secondary"
        disabled={!search || loading}
        onPress={() => search && void runSearch(search)}
      />
      <Button
        label="Report an environmental incident"
        variant="secondary"
        onPress={onReportIncident}
      />

      <ListSections value={section} options={discoverySections} onChange={changeSection} />
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
              style={[
                styles.radiusOption,
                radiusMeters === radius && styles.radiusOptionSelected,
              ]}
            >
              <Text
                style={[
                  styles.radiusOptionText,
                  radiusMeters === radius && styles.radiusOptionTextSelected,
                ]}
              >
                {radius / 1_000} km
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.radiusSummary}>
          {search
            ? `${events.length} ${section === "awaiting" ? "incident" : "published event"}${events.length === 1 ? "" : "s"} loaded`
            : "Location required first"}
        </Text>
      </View>

      {error ? <Notice tone="error" message={error} /> : null}
      {loading ? (
        <Notice
          tone="info"
          message={`Loading ${section === "awaiting" ? "incidents" : "published cleanup events"} within ${radiusMeters / 1_000} km.`}
        />
      ) : null}

      <AdministrativeAreaMapSearch
        accessToken={accessToken}
        onBoundaryChange={setSearchedBoundary}
      />

      <EcoMap
        markers={events}
        boundaries={searchedBoundary}
        selectedMarkerId={selectedId}
        focusLocation={focusLocation}
        selectedLocation={focusLocation}
        searchRadiusMeters={search?.radiusMeters}
        showListFallback
        showMarkerCoordinates={false}
        listTitle={`${section === "awaiting" ? "Incidents awaiting cleanup" : "Cleanup events"} within ${radiusMeters / 1_000} km`}
        showCurrentLocation={false}
        height={430}
        accessibleLabel={section === "awaiting" ? "Incidents awaiting cleanup map" : "Published cleanup event discovery map"}
        onMarkerSelect={(marker) => selectEvent(marker.properties.id)}
        markerActionLabel={(marker) =>
          marker.properties.kind === "INCIDENT" ? `View incident: ${marker.properties.title}` : marker.properties.isJoined
            ? `View event details: ${marker.properties.title}`
            : `Join event: ${marker.properties.title}`
        }
        onMarkerAction={(marker) => marker.properties.kind === "INCIDENT" ? selectEvent(marker.properties.id) : onOpenEvent(marker.properties.id)}
        onInteractionChange={setMapInteracting}
      />

      {selectedEvent ? (
        <View style={[sharedStyles.card, styles.detail]}>
          <Text style={styles.category}>
            {selectedEvent.properties.organizationName}
          </Text>
          <Text style={sharedStyles.sectionTitle}>
            {selectedEvent.properties.title}
          </Text>
          <Text style={sharedStyles.sectionSubtitle}>
            {selectedEvent.properties.isJoined
              ? "You joined this event."
              : "Published cleanup event"}
          </Text>
          {detailLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : eventDetail ? (
            <>
              <View style={sharedStyles.divider} />
              <Text style={styles.description}>{eventDetail.description}</Text>
              {eventDetail.publicInstructions ? (
                <Text style={styles.description}>
                  Volunteer instructions: {eventDetail.publicInstructions}
                </Text>
              ) : null}
              <View style={sharedStyles.spacedRow}>
                <Text style={styles.detailLabel}>STATUS</Text>
                <Text style={styles.detailValue}>
                  {readable(eventDetail.displayStatus)}
                </Text>
              </View>
              <View style={sharedStyles.spacedRow}>
                <Text style={styles.detailLabel}>LOCATION</Text>
                <Text style={styles.detailValue}>
                  {eventDetail.meetingAddress ??
                    eventDetail.eventAddress ??
                    "Map location"}
                </Text>
              </View>
              <View style={sharedStyles.spacedRow}>
                <Text style={styles.detailLabel}>STARTS</Text>
                <Text style={styles.detailValue}>
                  {new Date(eventDetail.startsAt).toLocaleString()}
                </Text>
              </View>
              <View style={sharedStyles.spacedRow}>
                <Text style={styles.detailLabel}>PARTICIPATION</Text>
                <Text style={styles.detailValue}>
                  {selectedEvent.properties.isJoined ? "Joined" : "Not joined"}
                </Text>
              </View>
              <Button
                label={
                  selectedEvent.properties.isJoined
                    ? "View event details"
                    : "Join event"
                }
                onPress={() => onOpenEvent(selectedEvent.properties.id)}
              />
            </>
          ) : null}
        </View>
      ) : null}

      {section === "awaiting" && selectedId && detailLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {incidentDetail && <IncidentEvidence incident={incidentDetail} awaitingCleanup={section === "awaiting"} />}

      {!search ? (
        <View style={sharedStyles.card}>
          <Text style={sharedStyles.sectionTitle}>
            Use your location to begin
          </Text>
        </View>
      ) : !loading && events.length === 0 ? (
        <View style={sharedStyles.card}>
          <Text style={sharedStyles.sectionTitle}>
            {section === "awaiting" ? "No incidents awaiting cleanup found" : "No published cleanup events found"}
          </Text>
          <Text style={sharedStyles.sectionSubtitle}>
            Try a larger search radius or refresh the search.
          </Text>
        </View>
      ) : null}

      <PageControls hasNext={Boolean(nextCursor && search)} busy={loading} next={() => { if (search && nextCursor) void runSearch(search, { append: true, cursor: nextCursor }); }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  category: { color: colors.primary, fontSize: 11, fontWeight: "900" },
  detail: { borderRadius: 10 },
  description: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
  detailLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "900" },
  detailValue: { color: colors.text, fontSize: 14, fontWeight: "900" },
  radiusCard: {
    gap: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  radiusLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },
  radiusOptions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  radiusOption: {
    minWidth: 58,
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  radiusOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  radiusOptionText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "800",
  },
  radiusOptionTextSelected: { color: colors.primary },
  radiusSummary: { color: colors.textMuted, fontSize: 12 },
});
