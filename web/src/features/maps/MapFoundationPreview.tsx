import { useState } from "react";

import { COLOMBO_MAP_CENTER } from "./map.constants";
import type {
  MapLocation,
  MapMarkerFeature,
  MapViewport,
} from "./map.types";
import { EcoMap } from "./EcoMap";
import { LocationPicker } from "./LocationPicker";

const previewMarkers: MapMarkerFeature[] = [
  {
    type: "Feature",
    geometry: { type: "Point", coordinates: [79.8544, 6.9278] },
    properties: {
      id: "preview-incident-1",
      kind: "INCIDENT",
      title: "Waste near Beira Lake",
      status: "ACTIVE",
      category: "Illegal dumping",
    },
  },
  {
    type: "Feature",
    geometry: { type: "Point", coordinates: [79.8565, 6.9292] },
    properties: {
      id: "preview-incident-2",
      kind: "INCIDENT",
      title: "Blocked canal outlet",
      status: "NEW",
      category: "Water pollution",
    },
  },
  {
    type: "Feature",
    geometry: { type: "Point", coordinates: [79.8504, 6.9344] },
    properties: {
      id: "preview-event-1",
      kind: "CLEANUP_EVENT",
      title: "Community lakeside cleanup",
      status: "PUBLISHED",
      category: "Cleanup event",
    },
  },
];

export function MapFoundationPreview() {
  const [selectedMarkerId, setSelectedMarkerId] = useState<string>();
  const [viewport, setViewport] = useState<MapViewport | null>(null);
  const [location, setLocation] =
    useState<MapLocation>(COLOMBO_MAP_CENTER);
  const [confirmedLocation, setConfirmedLocation] =
    useState<MapLocation | null>(null);

  return (
    <main className="eco-map-preview">
      <header className="eco-map-preview-header">
        <div>
          <span>MAP-01 · Web foundation</span>
          <h1>Explore nearby environmental action</h1>
          <p>
            A reusable OpenStreetMap view for incidents, cleanup events, and
            confirmed locations.
          </p>
        </div>
        <div className="eco-map-preview-status" aria-live="polite">
          <span>Bounded viewport</span>
          <strong>
            {viewport
              ? `Zoom ${viewport.zoom} · ${(
                  viewport.east - viewport.west
                ).toFixed(3)}° wide`
              : "Move the map to test requests"}
          </strong>
        </div>
      </header>

      <section className="eco-map-preview-section">
        <div className="eco-map-preview-copy">
          <span className="eco-map-preview-kicker">Live map component</span>
          <h2>Incidents and cleanup events share one map contract</h2>
          <p>
            Select a marker from the map or the keyboard-accessible list. Nearby
            markers cluster automatically as the view changes.
          </p>
        </div>
        <EcoMap
          markers={previewMarkers}
          selectedMarkerId={selectedMarkerId}
          onMarkerSelect={(marker) =>
            setSelectedMarkerId(marker.properties.id)
          }
          onViewportChange={(nextViewport) => {
            setViewport(nextViewport);
          }}
        />
      </section>

      <section className="eco-map-preview-section">
        <div className="eco-map-preview-copy">
          <span className="eco-map-preview-kicker">Reusable location picker</span>
          <h2>Choose GPS or place a pin manually</h2>
          <p>
            Location is requested only after the user presses “My location.”
            Manual map and coordinate entry remain available when permission is
            denied.
          </p>
          {confirmedLocation && (
            <p className="eco-map-preview-confirmed" role="status">
              Confirmed: {confirmedLocation.latitude.toFixed(6)},{" "}
              {confirmedLocation.longitude.toFixed(6)}
            </p>
          )}
        </div>
        <LocationPicker
          value={location}
          onChange={setLocation}
          onConfirm={setConfirmedLocation}
        />
      </section>
    </main>
  );
}

