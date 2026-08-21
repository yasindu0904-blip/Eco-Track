import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CircleMarker,
  GeoJSON,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { geoJSON } from "leaflet";
import type { GeoJsonObject } from "geojson";

import "leaflet/dist/leaflet.css";
import "./map.css";

import {
  COLOMBO_MAP_CENTER,
  MAP_REQUEST_LIMITS,
  SRI_LANKA_MAP_BOUNDS,
} from "./map.constants";
import type {
  MapLocation,
  MapBoundaryFeature,
  MapBoundaryFeatureCollection,
  MapMarkerFeature,
  MapViewport,
  MapViewportChangeHandler,
} from "./map.types";
import { markerLocation } from "./map.types";
import { clusterMarkers } from "./markerClustering";
import { useDebouncedViewport } from "./useDebouncedViewport";

const MAX_MAP_ZOOM = 19;

export interface EcoMapProps {
  markers?: MapMarkerFeature[];
  boundaries?: MapBoundaryFeatureCollection;
  initialCenter?: MapLocation;
  initialZoom?: number;
  focusLocation?: MapLocation | null;
  searchRadiusMeters?: number;
  selectedMarkerId?: string;
  selectedLocation?: MapLocation | null;
  selectionEnabled?: boolean;
  selectionMode?: "point" | "center";
  height?: number | string;
  className?: string;
  accessibleLabel?: string;
  showListFallback?: boolean;
  showCurrentLocation?: boolean;
  onMarkerSelect?: (marker: MapMarkerFeature) => void;
  markerActionLabel?: (marker: MapMarkerFeature) => string | undefined;
  onMarkerAction?: (marker: MapMarkerFeature) => void;
  onLocationSelect?: (location: MapLocation) => void;
  onViewportChange?: MapViewportChangeHandler;
}

function OrganizationBoundaryLayer({
  boundaries,
}: {
  boundaries: MapBoundaryFeatureCollection;
}) {
  const map = useMap();
  const [activeAreaIndex, setActiveAreaIndex] = useState(0);
  const hasFocusedInitialBoundaries = useRef(false);

  const focusArea = useCallback((area: MapBoundaryFeature) => {
    const bounds = geoJSON(
      area as GeoJsonObject,
    ).getBounds();

    if (bounds.isValid()) {
      map.fitBounds(bounds, {
        padding: [42, 42],
        maxZoom: 16,
      });
    }
  }, [map]);

  useEffect(() => {
    if (hasFocusedInitialBoundaries.current || boundaries.features.length === 0) {
      return;
    }

    const bounds = geoJSON(boundaries as GeoJsonObject).getBounds();
    if (bounds.isValid()) {
      hasFocusedInitialBoundaries.current = true;
      map.fitBounds(bounds, {
        padding: [42, 42],
        maxZoom: 16,
      });
    }
  }, [boundaries, map]);

  const focusNextArea = () => {
    const nextIndex = (activeAreaIndex + 1) % boundaries.features.length;
    setActiveAreaIndex(nextIndex);
    focusArea(boundaries.features[nextIndex]);
  };

  const activeArea = boundaries.features[activeAreaIndex];
  const nextArea =
    boundaries.features[(activeAreaIndex + 1) % boundaries.features.length];

  return (
    <>
      <GeoJSON
        key={`${boundaries.features.map((feature) => feature.properties.id).join(":")}:${activeArea?.properties.id ?? "none"}`}
        data={boundaries as GeoJsonObject}
        style={(feature) => {
          const isActive = feature?.properties.id === activeArea?.properties.id;

          return {
            color: isActive ? "#174c33" : "#101312",
            fill: true,
            fillColor: isActive ? "#3f8a5f" : "#ffffff",
            fillOpacity: isActive ? 0.18 : 0.04,
            opacity: 0.95,
            weight: isActive ? 4 : 3,
          };
        }}
        onEachFeature={(feature, layer) => {
          const area = feature as MapBoundaryFeature;
          const label = document.createElement("span");
          label.textContent = `${area.properties.name} — click to focus`;
          layer.bindTooltip(label, { direction: "top", sticky: true });
          layer.on("click", () => {
            const areaIndex = boundaries.features.findIndex(
              (candidate) => candidate.properties.id === area.properties.id,
            );
            if (areaIndex >= 0) setActiveAreaIndex(areaIndex);
            focusArea(area);
          });
        }}
      />
      <button
        type="button"
        className="eco-map-boundary-control"
        onClick={focusNextArea}
        aria-label={`Focus next service area${nextArea ? `: ${nextArea.properties.name}` : ""}`}
        title={nextArea ? `Next: ${nextArea.properties.name}` : "Focus service area"}
      >
        <span aria-hidden="true">→</span>
        <span>{boundaries.features.length > 1 ? "Next area" : "Focus area"}</span>
      </button>
    </>
  );
}

function isViewportBounded(viewport: MapViewport): boolean {
  return (
    viewport.east - viewport.west <=
      MAP_REQUEST_LIMITS.maxLongitudeSpanDegrees &&
    viewport.north - viewport.south <=
      MAP_REQUEST_LIMITS.maxLatitudeSpanDegrees
  );
}

interface MapInteractionControllerProps {
  selectionEnabled: boolean;
  selectionMode: "point" | "center";
  onLocationSelect?: (location: MapLocation) => void;
  onViewport: (viewport: MapViewport) => void;
  onViewportLimitChange: (isTooWide: boolean) => void;
  onZoomChange: (zoom: number) => void;
}

function MapInteractionController({
  selectionEnabled,
  selectionMode,
  onLocationSelect,
  onViewport,
  onViewportLimitChange,
  onZoomChange,
}: MapInteractionControllerProps) {
  const map = useMap();
  const publishViewport = useCallback(
    (map: ReturnType<typeof useMap>) => {
      const bounds = map.getBounds();
      const viewport: MapViewport = {
        west: bounds.getWest(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        north: bounds.getNorth(),
        zoom: map.getZoom(),
      };
      const tooWide = !isViewportBounded(viewport);
      onZoomChange(viewport.zoom);
      onViewportLimitChange(tooWide);

      if (!tooWide) {
        onViewport(viewport);
      }
    },
    [onViewport, onViewportLimitChange, onZoomChange],
  );

  useEffect(() => {
    publishViewport(map);
  }, [map, publishViewport]);

  useMapEvents({
    click(event) {
      if (selectionEnabled) {
        if (selectionMode === "center") {
          event.target.panTo(event.latlng);
        } else {
          onLocationSelect?.({
            latitude: event.latlng.lat,
            longitude: event.latlng.lng,
          });
        }
      }
    },
    moveend(event) {
      publishViewport(event.target);

      if (selectionEnabled && selectionMode === "center") {
        const center = event.target.getCenter();
        onLocationSelect?.({
          latitude: center.lat,
          longitude: center.lng,
        });
      }
    },
    zoomend(event) {
      publishViewport(event.target);
    },
  });

  return null;
}

interface MapCenterSynchronizerProps {
  location: MapLocation | null | undefined;
  enabled: boolean;
  radiusMeters?: number;
}

function MapCenterSynchronizer({
  location,
  enabled,
  radiusMeters,
}: MapCenterSynchronizerProps) {
  const map = useMap();

  useEffect(() => {
    if (!enabled || !location) {
      return;
    }

    const nextCenter: [number, number] = [
      location.latitude,
      location.longitude,
    ];

    if (radiusMeters) {
      const latitudeDelta = radiusMeters / 111_320;
      const longitudeDelta = radiusMeters /
        (111_320 * Math.max(Math.cos(location.latitude * Math.PI / 180), 0.01));
      map.fitBounds([
        [location.latitude - latitudeDelta, location.longitude - longitudeDelta],
        [location.latitude + latitudeDelta, location.longitude + longitudeDelta],
      ], { padding: [36, 36] });
    } else if (map.distance(map.getCenter(), nextCenter) > 1) {
      map.panTo(nextCenter);
    }
  }, [enabled, location, map, radiusMeters]);

  return null;
}

interface CurrentLocationControlProps {
  onLocationSelect?: (location: MapLocation) => void;
  onError: (message: string | null) => void;
}

function CurrentLocationControl({
  onLocationSelect,
  onError,
}: CurrentLocationControlProps) {
  const map = useMap();

  const locate = () => {
    if (!("geolocation" in navigator)) {
      onError("This browser does not provide location access. Select a point manually.");
      return;
    }

    onError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        map.setView([location.latitude, location.longitude], 15);
        onLocationSelect?.(location);
      },
      () => {
        onError("Location permission was denied or unavailable. You can still select a point manually.");
      },
      {
        enableHighAccuracy: false,
        maximumAge: 60_000,
        timeout: 10_000,
      },
    );
  };

  return (
    <button
      type="button"
      className="eco-map-location-control"
      onClick={locate}
      aria-label="Use my current location"
      title="Use my current location"
    >
      <span aria-hidden="true">◎</span>
      <span>My location</span>
    </button>
  );
}

interface MarkerLayerProps {
  markers: MapMarkerFeature[];
  zoom: number;
  selectedMarkerId?: string;
  onMarkerSelect?: (marker: MapMarkerFeature) => void;
  markerActionLabel?: (marker: MapMarkerFeature) => string | undefined;
  onMarkerAction?: (marker: MapMarkerFeature) => void;
}

function ClusteredMarkerLayer({
  markers,
  zoom,
  selectedMarkerId,
  onMarkerSelect,
  markerActionLabel,
  onMarkerAction,
}: MarkerLayerProps) {
  const map = useMap();
  const clusters = useMemo(
    () => clusterMarkers(markers, zoom),
    [markers, zoom],
  );

  return clusters.map((cluster) => {
    if (cluster.markers.length > 1) {
      return (
        <CircleMarker
          key={cluster.id}
          center={[cluster.latitude, cluster.longitude]}
          radius={18}
          pathOptions={{
            color: "#ffffff",
            fillColor: "#174c33",
            fillOpacity: 1,
            weight: 3,
          }}
          eventHandlers={{
            click: () => {
              map.setView(
                [cluster.latitude, cluster.longitude],
                Math.min(18, zoom + 2),
              );
            },
          }}
        >
          <Popup>
            <strong>{cluster.markers.length} nearby locations</strong>
            <br />Zoom in to explore them individually.
          </Popup>
        </CircleMarker>
      );
    }

    const marker = cluster.markers[0];
    const location = markerLocation(marker);
    const isIncident = marker.properties.kind === "INCIDENT";
    const isSelected = marker.properties.id === selectedMarkerId;
    const actionLabel = markerActionLabel?.(marker);

    return (
      <CircleMarker
        key={marker.properties.id}
        center={[location.latitude, location.longitude]}
        radius={isSelected ? 13 : 10}
        pathOptions={{
          color: "#ffffff",
          fillColor: isIncident ? "#d34a3a" : "#2878b5",
          fillOpacity: 1,
          weight: isSelected ? 4 : 3,
        }}
        eventHandlers={{
          click: () => onMarkerSelect?.(marker),
        }}
      >
        <Popup>
          <strong>{marker.properties.title}</strong>
          <br />
          {marker.properties.category ?? marker.properties.status}
          {actionLabel && onMarkerAction ? (
            <>
              <br />
              <button
                type="button"
                className="eco-map-marker-action"
                onClick={() => onMarkerAction(marker)}
              >
                {actionLabel}
              </button>
            </>
          ) : null}
        </Popup>
      </CircleMarker>
    );
  });
}

export function EcoMap({
  markers = [],
  boundaries,
  initialCenter = COLOMBO_MAP_CENTER,
  initialZoom = 12,
  focusLocation,
  searchRadiusMeters,
  selectedMarkerId,
  selectedLocation,
  selectionEnabled = false,
  selectionMode = "point",
  height = 520,
  className = "",
  accessibleLabel = "EcoTrack incident and cleanup event map",
  showListFallback = true,
  showCurrentLocation = true,
  onMarkerSelect,
  markerActionLabel,
  onMarkerAction,
  onLocationSelect,
  onViewportChange,
}: EcoMapProps) {
  const [zoom, setZoom] = useState(initialZoom);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [viewportTooWide, setViewportTooWide] = useState(false);
  const scheduleViewport = useDebouncedViewport(
    onViewportChange,
    MAP_REQUEST_LIMITS.debounceMilliseconds,
  );

  return (
    <section
      className={`eco-map-shell ${className}`.trim()}
      aria-label={accessibleLabel}
    >
      <div className="eco-map-canvas" style={{ height }}>
        <MapContainer
          center={[initialCenter.latitude, initialCenter.longitude]}
          zoom={initialZoom}
          minZoom={7}
          maxZoom={MAX_MAP_ZOOM}
          maxBounds={[
            [SRI_LANKA_MAP_BOUNDS.south, SRI_LANKA_MAP_BOUNDS.west],
            [SRI_LANKA_MAP_BOUNDS.north, SRI_LANKA_MAP_BOUNDS.east],
          ]}
          maxBoundsViscosity={0.8}
          scrollWheelZoom
          className="eco-map-leaflet"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapInteractionController
            selectionEnabled={selectionEnabled}
            selectionMode={selectionMode}
            onLocationSelect={onLocationSelect}
            onViewport={scheduleViewport}
            onViewportLimitChange={setViewportTooWide}
            onZoomChange={setZoom}
          />
          <MapCenterSynchronizer
            location={focusLocation ?? selectedLocation}
            radiusMeters={searchRadiusMeters}
            enabled={
              Boolean(focusLocation) ||
              (selectionEnabled && selectionMode === "center")
            }
          />
          <ClusteredMarkerLayer
            markers={markers}
            zoom={zoom}
            selectedMarkerId={selectedMarkerId}
            onMarkerSelect={onMarkerSelect}
            markerActionLabel={markerActionLabel}
            onMarkerAction={onMarkerAction}
          />
          {boundaries && boundaries.features.length > 0 && (
            <OrganizationBoundaryLayer boundaries={boundaries} />
          )}
          {selectedLocation && selectionMode === "point" && (
            <CircleMarker
              center={[
                selectedLocation.latitude,
                selectedLocation.longitude,
              ]}
              radius={12}
              pathOptions={{
                color: "#163f2b",
                fillColor: "#f1b642",
                fillOpacity: 1,
                weight: 4,
              }}
            >
              <Popup>Selected location</Popup>
            </CircleMarker>
          )}
          {showCurrentLocation && (
            <CurrentLocationControl
              onLocationSelect={onLocationSelect}
              onError={setLocationError}
            />
          )}
        </MapContainer>

        {selectionEnabled && selectionMode === "center" && (
          <div className="eco-map-center-pin" aria-hidden="true">
            <span className="eco-map-center-pin-shape">
              <span />
            </span>
            <span className="eco-map-center-pin-shadow" />
          </div>
        )}

        {selectionEnabled && (
          <p className="eco-map-selection-hint">
            {selectionMode === "center"
              ? "Move the map to position the black pin."
              : "Click or tap the map to move the pin."}
          </p>
        )}
        {viewportTooWide && (
          <p className="eco-map-viewport-warning" role="status">
            Zoom in to load locations. Wide national requests are disabled.
          </p>
        )}
      </div>

      {locationError && (
        <p className="eco-map-message" role="status">
          {locationError}
        </p>
      )}

      {showListFallback && markers.length > 0 && (
        <div className="eco-map-list-fallback">
          <div className="eco-map-list-heading">
            <h3>Locations in this view</h3>
            <span>{markers.length}</span>
          </div>
          <ul>
            {markers.map((marker) => {
              const location = markerLocation(marker);
              return (
                <li key={marker.properties.id}>
                  <button
                    type="button"
                    className={
                      marker.properties.id === selectedMarkerId
                        ? "is-selected"
                        : undefined
                    }
                    onClick={() => onMarkerSelect?.(marker)}
                  >
                    <span
                      className={`eco-map-list-dot eco-map-list-dot-${marker.properties.kind.toLowerCase()}`}
                      aria-hidden="true"
                    />
                    <span>
                      <strong>{marker.properties.title}</strong>
                      <small>
                        {marker.properties.status} · {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                      </small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
