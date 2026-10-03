import type { MapMarkerFeature } from "./map.types";
import { markerLocation } from "./map.types";

export const CLUSTER_BREAK_ZOOM = 17;

export interface MarkerCluster {
  id: string;
  latitude: number;
  longitude: number;
  markers: MapMarkerFeature[];
}

export function clusterMarkers(
  markers: MapMarkerFeature[],
  zoom: number,
): MarkerCluster[] {
  if (zoom >= CLUSTER_BREAK_ZOOM) {
    return markers.map((marker) => {
      const location = markerLocation(marker);

      return {
        id: `marker:${marker.properties.id}`,
        latitude: location.latitude,
        longitude: location.longitude,
        markers: [marker],
      };
    });
  }

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
