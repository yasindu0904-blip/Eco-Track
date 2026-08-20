import { describe, expect, test } from "vitest";

import type { MapMarkerFeature } from "./map.types";
import { CLUSTER_BREAK_ZOOM, clusterMarkers } from "./markerClustering";

function marker(id: string, longitude: number, latitude: number): MapMarkerFeature {
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [longitude, latitude] },
    properties: {
      id,
      kind: "INCIDENT",
      title: `Incident ${id}`,
      status: "Active",
    },
  };
}

describe("dense web marker clustering", () => {
  test("groups dense markers without dropping or duplicating them", () => {
    const markers = Array.from({ length: 250 }, (_, index) =>
      marker(
        `dense-${index}`,
        79.86 + (index % 10) * 0.00001,
        6.91 + Math.floor(index / 10) * 0.00001,
      ),
    );

    const clusters = clusterMarkers(markers, 12);

    expect(clusters.length).toBeLessThan(markers.length);
    expect(clusters.flatMap((cluster) => cluster.markers)).toHaveLength(250);
    expect(new Set(clusters.flatMap((cluster) => cluster.markers.map((item) => item.properties.id))).size)
      .toBe(250);
  });

  test("breaks clusters into individually selectable markers at detail zoom", () => {
    const markers = [
      marker("one", 79.86, 6.91),
      marker("two", 79.86001, 6.91001),
    ];

    const clusters = clusterMarkers(markers, CLUSTER_BREAK_ZOOM);

    expect(clusters).toHaveLength(2);
    expect(clusters.every((cluster) => cluster.markers.length === 1)).toBe(true);
  });
});
