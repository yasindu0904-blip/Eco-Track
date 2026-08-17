import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  type CameraRef,
  type FilterSpecification,
  type GeoJSONSourceRef,
  type ViewStateChangeEvent,
} from "@maplibre/maplibre-react-native";
import * as Location from "expo-location";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { colors } from "../../../components/theme";
import {
  COLOMBO_MAP_CENTER,
  MAP_REQUEST_LIMITS,
  OPENSTREETMAP_RASTER_STYLE,
  SRI_LANKA_MAP_BOUNDS,
  isWithinSriLankaBounds,
} from "../map.constants";
import type {
  MapBoundaryFeatureCollection,
  MapLocation,
  MapMarkerFeature,
  MapViewport,
  MapViewportChangeHandler,
} from "../map.types";
import { markerLocation } from "../map.types";
import { useDebouncedViewport } from "../hooks/useDebouncedViewport";

const clusterFilter: FilterSpecification = ["has", "point_count"];
const unclusteredFilter: FilterSpecification = [
  "!",
  ["has", "point_count"],
];
const incidentFilter: FilterSpecification = [
  "all",
  unclusteredFilter,
  ["==", ["get", "kind"], "INCIDENT"],
];
const cleanupEventFilter: FilterSpecification = [
  "all",
  unclusteredFilter,
  ["==", ["get", "kind"], "CLEANUP_EVENT"],
];

export interface EcoMapProps {
  markers?: MapMarkerFeature[];
  boundaries?: MapBoundaryFeatureCollection;
  initialCenter?: MapLocation;
  initialZoom?: number;
  selectedMarkerId?: string;
  selectedLocation?: MapLocation | null;
  selectionEnabled?: boolean;
  selectionMode?: "point" | "center";
  height?: number;
  accessibleLabel?: string;
  showListFallback?: boolean;
  onMarkerSelect?: (marker: MapMarkerFeature) => void;
  onLocationSelect?: (location: MapLocation) => void;
  onViewportChange?: MapViewportChangeHandler;
  onInteractionChange?: (isInteracting: boolean) => void;
}

function getGeometryBounds(
  coordinates: unknown,
): [number, number, number, number] | null {
  let west = Number.POSITIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;

  const visit = (value: unknown): void => {
    if (
      Array.isArray(value) &&
      value.length >= 2 &&
      typeof value[0] === "number" &&
      typeof value[1] === "number"
    ) {
      west = Math.min(west, value[0]);
      south = Math.min(south, value[1]);
      east = Math.max(east, value[0]);
      north = Math.max(north, value[1]);
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(visit);
    }
  };

  visit(coordinates);

  return Number.isFinite(west) ? [west, south, east, north] : null;
}

function viewportIsBounded(viewport: MapViewport): boolean {
  return (
    viewport.east - viewport.west <=
      MAP_REQUEST_LIMITS.maxLongitudeSpanDegrees &&
    viewport.north - viewport.south <=
      MAP_REQUEST_LIMITS.maxLatitudeSpanDegrees
  );
}

function locationsDiffer(
  first: MapLocation | null,
  second: MapLocation,
): boolean {
  if (!first) {
    return true;
  }

  return (
    Math.abs(first.latitude - second.latitude) > 0.000001 ||
    Math.abs(first.longitude - second.longitude) > 0.000001
  );
}

export function EcoMap({
  markers = [],
  boundaries,
  initialCenter = COLOMBO_MAP_CENTER,
  initialZoom = 12,
  selectedMarkerId,
  selectedLocation,
  selectionEnabled = false,
  selectionMode = "point",
  height = 480,
  accessibleLabel = "EcoTrack incident and cleanup event map",
  showListFallback = true,
  onMarkerSelect,
  onLocationSelect,
  onViewportChange,
  onInteractionChange,
}: EcoMapProps) {
  const cameraRef = useRef<CameraRef>(null);
  const markerSourceRef = useRef<GeoJSONSourceRef>(null);
  const lastMapCenterRef = useRef<MapLocation | null>(initialCenter);
  const [locationBusy, setLocationBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [viewportTooWide, setViewportTooWide] = useState(false);
  const [activeAreaIndex, setActiveAreaIndex] = useState(0);
  const scheduleViewport = useDebouncedViewport(
    onViewportChange,
    MAP_REQUEST_LIMITS.debounceMilliseconds,
  );
  const markerCollection = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: "FeatureCollection",
      features: markers,
    }),
    [markers],
  );
  const activeArea = boundaries?.features[activeAreaIndex] ?? boundaries?.features[0];
  const activeAreaBounds = useMemo(
    () => activeArea ? getGeometryBounds(activeArea.geometry.coordinates) : null,
    [activeArea],
  );

  useEffect(() => {
    if (!activeAreaBounds) return;
    cameraRef.current?.fitBounds(activeAreaBounds, {
      padding: { top: 42, right: 42, bottom: 42, left: 42 },
      duration: 400,
    });
  }, [activeAreaBounds]);

  useEffect(() => {
    if (
      selectionEnabled &&
      selectionMode === "center" &&
      selectedLocation &&
      locationsDiffer(lastMapCenterRef.current, selectedLocation)
    ) {
      lastMapCenterRef.current = selectedLocation;
      cameraRef.current?.easeTo({
        center: [
          selectedLocation.longitude,
          selectedLocation.latitude,
        ],
        duration: 250,
      });
    }
  }, [selectedLocation, selectionEnabled, selectionMode]);

  const selectLocation = useCallback(
    (location: MapLocation) => {
      if (!isWithinSriLankaBounds(location)) {
        setMessage("Select a location inside the supported Sri Lanka map area.");
        return;
      }

      setMessage(null);
      lastMapCenterRef.current = location;
      onLocationSelect?.(location);
    },
    [onLocationSelect],
  );

  const handleRegionDidChange = useCallback(
    (event: NativeSyntheticEvent<ViewStateChangeEvent>) => {
      const { bounds, center, zoom } = event.nativeEvent;
      const viewport: MapViewport = {
        west: bounds[0],
        south: bounds[1],
        east: bounds[2],
        north: bounds[3],
        zoom,
      };
      const nextCenter = {
        longitude: center[0],
        latitude: center[1],
      };
      lastMapCenterRef.current = nextCenter;

      const tooWide = !viewportIsBounded(viewport);
      setViewportTooWide(tooWide);

      if (!tooWide) {
        scheduleViewport(viewport);
      }

      if (selectionEnabled && selectionMode === "center") {
        selectLocation(nextCenter);
      }

      onInteractionChange?.(false);
    },
    [
      onInteractionChange,
      scheduleViewport,
      selectLocation,
      selectionEnabled,
      selectionMode,
    ],
  );

  const useCurrentLocation = async () => {
    if (locationBusy) {
      return;
    }

    setLocationBusy(true);
    setMessage(null);

    try {
      const permission =
        await Location.requestForegroundPermissionsAsync();

      if (!permission.granted) {
        setMessage(
          "Location permission was denied. Move the map or enter coordinates manually.",
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

      if (!isWithinSriLankaBounds(location)) {
        setMessage(
          "Your current position is outside the supported Sri Lanka map area. Select a point manually.",
        );
        return;
      }

      lastMapCenterRef.current = location;
      cameraRef.current?.easeTo({
        center: [location.longitude, location.latitude],
        zoom: 15,
        duration: 450,
      });
      onLocationSelect?.(location);
    } catch {
      setMessage(
        "Current location is unavailable. Move the map or enter coordinates manually.",
      );
    } finally {
      setLocationBusy(false);
    }
  };

  const handleMarkerPress = async (
    event: Parameters<NonNullable<React.ComponentProps<typeof GeoJSONSource>["onPress"]>>[0],
  ) => {
    const feature = event.nativeEvent.features[0];

    if (!feature || feature.geometry.type !== "Point") {
      return;
    }

    const coordinates = feature.geometry.coordinates;
    const properties = feature.properties;

    if (properties?.cluster && properties.cluster_id != null) {
      const expansionZoom =
        await markerSourceRef.current?.getClusterExpansionZoom(
          Number(properties.cluster_id),
        );
      cameraRef.current?.easeTo({
        center: [Number(coordinates[0]), Number(coordinates[1])],
        zoom: expansionZoom ?? 14,
        duration: 300,
      });
      return;
    }

    const markerId = String(properties?.id ?? "");
    const marker = markers.find(
      (candidate) => candidate.properties.id === markerId,
    );

    if (marker) {
      onMarkerSelect?.(marker);
    }
  };

  const handleBoundaryPress = (
    event: Parameters<NonNullable<React.ComponentProps<typeof GeoJSONSource>["onPress"]>>[0],
  ) => {
    const boundaryId = String(event.nativeEvent.features[0]?.properties?.id ?? "");
    const nextIndex = boundaries?.features.findIndex(
      (feature) => feature.properties.id === boundaryId,
    ) ?? -1;
    if (nextIndex >= 0) setActiveAreaIndex(nextIndex);
  };

  const focusNextArea = () => {
    if (!boundaries?.features.length) return;
    setActiveAreaIndex((current) => (current + 1) % boundaries.features.length);
  };

  const focusMarker = (marker: MapMarkerFeature) => {
    const location = markerLocation(marker);
    cameraRef.current?.easeTo({
      center: [location.longitude, location.latitude],
      zoom: 15,
      duration: 300,
    });
    onMarkerSelect?.(marker);
  };

  return (
    <View
      style={styles.shell}
      accessibilityLabel={accessibleLabel}
    >
      <View style={[styles.mapFrame, { height }]}> 
        <Map
          style={StyleSheet.absoluteFill}
          mapStyle={OPENSTREETMAP_RASTER_STYLE}
          androidView="texture"
          attribution
          attributionPosition={{ bottom: 8, left: 8 }}
          compass
          compassPosition={{ top: 64, right: 12 }}
          touchPitch={false}
          touchRotate={false}
          onTouchStart={() => onInteractionChange?.(true)}
          onTouchEnd={() => onInteractionChange?.(false)}
          onTouchCancel={() => onInteractionChange?.(false)}
          onRegionDidChange={handleRegionDidChange}
          onPress={(event) => {
            if (!selectionEnabled) {
              return;
            }

            const coordinate = event.nativeEvent.lngLat;
            const location = {
              longitude: coordinate[0],
              latitude: coordinate[1],
            };

            if (selectionMode === "center") {
              cameraRef.current?.easeTo({
                center: coordinate,
                duration: 250,
              });
            } else {
              selectLocation(location);
            }
          }}
          onDidFailLoadingMap={() =>
            setMessage(
              "Map tiles could not load. Coordinates can still be entered manually.",
            )
          }
        >
          <Camera
            ref={cameraRef}
            initialViewState={{
              center: [initialCenter.longitude, initialCenter.latitude],
              zoom: initialZoom,
            }}
            minZoom={7}
            maxZoom={19}
            maxBounds={[
              SRI_LANKA_MAP_BOUNDS.west,
              SRI_LANKA_MAP_BOUNDS.south,
              SRI_LANKA_MAP_BOUNDS.east,
              SRI_LANKA_MAP_BOUNDS.north,
            ]}
          />

          {boundaries && boundaries.features.length > 0 && (
            <GeoJSONSource
              id="eco-map-organization-boundaries"
              data={boundaries}
              onPress={handleBoundaryPress}
            >
              <Layer
                id="eco-map-organization-boundary-fill"
                type="fill"
                paint={{
                  "fill-color": "#ffffff",
                  "fill-opacity": 0.04,
                }}
              />
              <Layer
                id="eco-map-active-organization-boundary-fill"
                type="fill"
                filter={["==", ["get", "id"], activeArea?.properties.id ?? "__none__"]}
                paint={{
                  "fill-color": "#3f8a5f",
                  "fill-opacity": 0.18,
                }}
              />
              <Layer
                id="eco-map-organization-boundary-lines"
                type="line"
                paint={{
                  "line-color": "#101312",
                  "line-opacity": 0.95,
                  "line-width": 3,
                }}
              />
              <Layer
                id="eco-map-active-organization-boundary-line"
                type="line"
                filter={["==", ["get", "id"], activeArea?.properties.id ?? "__none__"]}
                paint={{
                  "line-color": "#174c33",
                  "line-opacity": 1,
                  "line-width": 4,
                }}
              />
            </GeoJSONSource>
          )}

          {markers.length > 0 && (
            <GeoJSONSource
              ref={markerSourceRef}
              id="eco-map-markers"
              data={markerCollection}
              cluster
              clusterRadius={48}
              clusterMaxZoom={14}
              onPress={(event) => void handleMarkerPress(event)}
            >
              <Layer
                id="eco-map-clusters"
                type="circle"
                filter={clusterFilter}
                paint={{
                  "circle-color": "#174c33",
                  "circle-radius": 19,
                  "circle-stroke-color": "#ffffff",
                  "circle-stroke-width": 3,
                }}
              />
              <Layer
                id="eco-map-cluster-count"
                type="symbol"
                filter={clusterFilter}
                layout={{
                  "text-field": ["get", "point_count_abbreviated"],
                  "text-size": 12,
                }}
                paint={{ "text-color": "#ffffff" }}
              />
              <Layer
                id="eco-map-incidents"
                type="circle"
                filter={incidentFilter}
                paint={{
                  "circle-color": "#d34a3a",
                  "circle-radius": 10,
                  "circle-stroke-color": "#ffffff",
                  "circle-stroke-width": 3,
                }}
              />
              <Layer
                id="eco-map-cleanup-events"
                type="circle"
                filter={cleanupEventFilter}
                paint={{
                  "circle-color": "#2878b5",
                  "circle-radius": 10,
                  "circle-stroke-color": "#ffffff",
                  "circle-stroke-width": 3,
                }}
              />
              <Layer
                id="eco-map-selected-marker"
                type="circle"
                filter={[
                  "==",
                  ["get", "id"],
                  selectedMarkerId ?? "__none__",
                ]}
                paint={{
                  "circle-color": "rgba(255,255,255,0)",
                  "circle-radius": 15,
                  "circle-stroke-color": "#101312",
                  "circle-stroke-width": 3,
                }}
              />
            </GeoJSONSource>
          )}

          {selectedLocation && selectionMode === "point" && (
            <GeoJSONSource
              id="eco-map-selected-location"
              data={{
                type: "Point",
                coordinates: [
                  selectedLocation.longitude,
                  selectedLocation.latitude,
                ],
              }}
            >
              <Layer
                id="eco-map-selected-location-dot"
                type="circle"
                paint={{
                  "circle-color": "#f1b642",
                  "circle-radius": 11,
                  "circle-stroke-color": "#101312",
                  "circle-stroke-width": 4,
                }}
              />
            </GeoJSONSource>
          )}
        </Map>

        <Pressable
          style={({ pressed }) => [
            styles.locationButton,
            pressed && styles.buttonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Use my current location"
          disabled={locationBusy}
          onPress={() => void useCurrentLocation()}
        >
          {locationBusy ? (
            <ActivityIndicator color={colors.primaryDark} size="small" />
          ) : (
            <Text style={styles.locationButtonIcon}>◎</Text>
          )}
          <Text style={styles.locationButtonText}>My location</Text>
        </Pressable>

        {activeAreaBounds && (
          <Pressable
            style={({ pressed }) => [
              styles.boundaryButton,
              pressed && styles.buttonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={
              boundaries && boundaries.features.length > 1
                ? "Focus next organization service area"
                : "Focus organization service area"
            }
            onPress={focusNextArea}
          >
            <Text style={styles.boundaryButtonIcon}>→</Text>
            <Text style={styles.boundaryButtonText}>
              {boundaries && boundaries.features.length > 1
                ? "Next area"
                : "Focus area"}
            </Text>
          </Pressable>
        )}

        {selectionEnabled && selectionMode === "center" && (
          <View pointerEvents="none" style={styles.centerPinContainer}>
            <View style={styles.centerPinShape}>
              <View style={styles.centerPinHole} />
            </View>
            <View style={styles.centerPinShadow} />
          </View>
        )}

        {selectionEnabled && (
          <View pointerEvents="none" style={styles.selectionHint}>
            <Text style={styles.selectionHintText}>
              {selectionMode === "center"
                ? "Move the map beneath the black pin"
                : "Tap the map to select a location"}
            </Text>
          </View>
        )}

        {viewportTooWide && (
          <View pointerEvents="none" style={styles.viewportWarning}>
            <Text style={styles.viewportWarningText}>
              Zoom in to load locations
            </Text>
          </View>
        )}
      </View>

      {message && (
        <Text style={styles.message} accessibilityLiveRegion="polite">
          {message}
        </Text>
      )}

      {showListFallback && markers.length > 0 && (
        <View style={styles.listFallback}>
          <View style={styles.listHeading}>
            <Text style={styles.listTitle}>Locations in this view</Text>
            <Text style={styles.listCount}>{markers.length}</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          >
            {markers.map((marker) => {
              const location = markerLocation(marker);
              const selected = marker.properties.id === selectedMarkerId;

              return (
                <Pressable
                  key={marker.properties.id}
                  style={({ pressed }) => [
                    styles.listItem,
                    selected && styles.listItemSelected,
                    pressed && styles.buttonPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${marker.properties.title}, ${marker.properties.status}`}
                  onPress={() => focusMarker(marker)}
                >
                  <View
                    style={[
                      styles.listDot,
                      marker.properties.kind === "CLEANUP_EVENT" &&
                        styles.eventDot,
                    ]}
                  />
                  <View style={styles.listItemText}>
                    <Text style={styles.listItemTitle} numberOfLines={1}>
                      {marker.properties.title}
                    </Text>
                    <Text style={styles.listItemMeta} numberOfLines={1}>
                      {marker.properties.status} · {location.latitude.toFixed(4)},{" "}
                      {location.longitude.toFixed(4)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    backgroundColor: colors.surface,
  },
  mapFrame: {
    position: "relative",
    minHeight: 320,
    overflow: "hidden",
    backgroundColor: "#dcebdc",
  },
  locationButton: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    minHeight: 42,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(23, 76, 51, 0.2)",
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.96)",
    elevation: 4,
  },
  locationButtonIcon: {
    color: colors.primaryDark,
    fontSize: 21,
    lineHeight: 22,
  },
  locationButtonText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "800",
  },
  boundaryButton: {
    position: "absolute",
    top: 62,
    right: 12,
    height: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(16,19,18,0.28)",
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.97)",
    elevation: 4,
  },
  boundaryButtonIcon: {
    color: "#101312",
    fontSize: 18,
    fontWeight: "900",
  },
  boundaryButtonText: {
    color: "#101312",
    fontSize: 12,
    fontWeight: "900",
  },
  centerPinContainer: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 48,
    height: 56,
    marginLeft: -24,
    marginTop: -56,
  },
  centerPinShape: {
    position: "absolute",
    left: 7,
    top: 7,
    alignItems: "center",
    justifyContent: "center",
    width: 34,
    height: 34,
    transform: [{ rotate: "-45deg" }],
    borderWidth: 3,
    borderColor: colors.surface,
    borderRadius: 17,
    borderBottomLeftRadius: 0,
    backgroundColor: "#101312",
    elevation: 6,
    zIndex: 1,
  },
  centerPinHole: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.surface,
  },
  centerPinShadow: {
    position: "absolute",
    left: 16,
    top: 52,
    width: 16,
    height: 4,
    borderRadius: 9,
    backgroundColor: "rgba(12,24,17,0.3)",
  },
  selectionHint: {
    position: "absolute",
    bottom: 18,
    alignSelf: "center",
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: "rgba(22,63,43,0.9)",
  },
  selectionHintText: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: "700",
  },
  viewportWarning: {
    position: "absolute",
    top: 64,
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: "rgba(126,70,14,0.94)",
  },
  viewportWarningText: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: "700",
  },
  message: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#ecd6b5",
    color: "#71430f",
    backgroundColor: "#fff8eb",
    fontSize: 13,
    lineHeight: 19,
  },
  listFallback: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  listHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  listTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  listCount: {
    overflow: "hidden",
    minWidth: 28,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
    color: colors.primaryDark,
    backgroundColor: colors.primarySoft,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  listContent: {
    gap: 8,
    padding: 12,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    width: 245,
    minHeight: 64,
    padding: 12,
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
  },
  listItemSelected: {
    borderColor: "#8eb59b",
    backgroundColor: colors.primarySoft,
  },
  listDot: {
    width: 12,
    height: 12,
    marginTop: 3,
    borderWidth: 2,
    borderColor: colors.surface,
    borderRadius: 6,
    backgroundColor: "#d34a3a",
  },
  eventDot: {
    backgroundColor: "#2878b5",
  },
  listItemText: {
    flex: 1,
    gap: 5,
  },
  listItemTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  listItemMeta: {
    color: colors.textMuted,
    fontSize: 11,
  },
  buttonPressed: {
    opacity: 0.72,
  },
});
