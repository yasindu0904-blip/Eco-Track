import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";
import "./map.css";

import {
  COLOMBO_MAP_CENTER,
  MAP_REQUEST_LIMITS,
  SRI_LANKA_MAP_BOUNDS,
} from "./map.constants";
import type {
  MapLocation,
  MapMarkerFeature,
  MapViewport,
  MapViewportChangeHandler,
} from "./map.types";
import { markerLocation } from "./map.types";
import { useDebouncedViewport } from "./useDebouncedViewport";

interface MarkerCluster {
  id: string;
  latitude: number;
  longitude: number;
  markers: MapMarkerFeature[];
}

export interface EcoMapProps {
  markers?: MapMarkerFeature[];
  initialCenter?: MapLocation;
  initialZoom?: number;
  selectedMarkerId?: string;
  selectedLocation?: MapLocation | null;
  selectionEnabled?: boolean;
  selectionMode?: "point" | "center";
  height?: number | string;
  className?: string;
  accessibleLabel?: string;
  onMarkerSelect?: (marker: MapMarkerFeature) => void;
  onLocationSelect?: (location: MapLocation) => void;
  onViewportChange?: MapViewportChangeHandler;
}

function clusterMarkers(
  markers: MapMarkerFeature[],
  zoom: number,
): MarkerCluster[] {
  const cellSizeDegrees = Math.max(0.008, 45 / 2 ** zoom);
  const groups = new Map<string, MapMarkerFeature[]>();

  for (const marker of markers) {
    const location = markerLocation(marker);
    const cellX = Math.floor(location.longitude / cellSizeDegrees);
    const cellY = Math.floor(location.latitude / cellSizeDegrees);
    const key = `${cellX}:${cellY}`;
    const group = groups.get(key) ?? [];
    group.push(marker);
    groups.set(key, group);
  }

  return [...groups.entries()].map(([id, groupedMarkers]) => {
    const total = groupedMarkers.reduce(
      (coordinates, marker) => {
        const location = markerLocation(marker);
        return {
          latitude: coordinates.latitude + location.latitude,
          longitude: coordinates.longitude + location.longitude,
        };
      },
      { latitude: 0, longitude: 0 },
    );

    return {
      id,
      latitude: total.latitude / groupedMarkers.length,
      longitude: total.longitude / groupedMarkers.length,
      markers: groupedMarkers,
    };
  });
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
}

function MapCenterSynchronizer({
  location,
  enabled,
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

    if (map.distance(map.getCenter(), nextCenter) > 1) {
      map.panTo(nextCenter);
    }
  }, [enabled, location, map]);

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
}

function ClusteredMarkerLayer({
  markers,
  zoom,
  selectedMarkerId,
  onMarkerSelect,
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
        </Popup>
      </CircleMarker>
    );
  });
}

export function EcoMap({
  markers = [],
  initialCenter = COLOMBO_MAP_CENTER,
  initialZoom = 12,
  selectedMarkerId,
  selectedLocation,
  selectionEnabled = false,
  selectionMode = "point",
  height = 520,
  className = "",
  accessibleLabel = "EcoTrack incident and cleanup event map",
  onMarkerSelect,
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
          maxZoom={19}
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
            location={selectedLocation}
            enabled={selectionEnabled && selectionMode === "center"}
          />
          <ClusteredMarkerLayer
            markers={markers}
            zoom={zoom}
            selectedMarkerId={selectedMarkerId}
            onMarkerSelect={onMarkerSelect}
          />
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
          <CurrentLocationControl
            onLocationSelect={onLocationSelect}
            onError={setLocationError}
          />
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

      {markers.length > 0 && (
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
