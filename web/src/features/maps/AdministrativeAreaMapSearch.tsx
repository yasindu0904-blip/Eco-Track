import { useEffect, useRef, useState } from "react";
import { describeApiFailure } from "../../api/apiError";
import { getAdministrativeAreaBoundary, listAdministrativeAreas } from "../organizations/application/organizationApplication.api";
import type { AdministrativeArea } from "../organizations/application/organizationApplication.types";
import type { MapBoundaryFeatureCollection } from "./map.types";

type Props = { accessToken: string; onBoundaryChange: (boundary: MapBoundaryFeatureCollection | undefined) => void };

export function AdministrativeAreaMapSearch({ accessToken, onBoundaryChange }: Props) {
  const [query, setQuery] = useState("");
  const [selectedArea, setSelectedArea] = useState<AdministrativeArea>();
  const [areas, setAreas] = useState<AdministrativeArea[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const selectionRequest = useRef(0);

  useEffect(() => {
    if (selectedArea || query.trim().length < 2) return;
    let active = true;
    const timeout = window.setTimeout(() => {
      setBusy(true); setError(undefined);
      void listAdministrativeAreas(accessToken, query)
        .then((value) => { if (active) setAreas(value); })
        .catch((reason) => { if (active) setError(describeApiFailure(reason, "Unable to search GN Divisions.").message); })
        .finally(() => { if (active) setBusy(false); });
    }, 300);
    return () => { active = false; window.clearTimeout(timeout); };
  }, [accessToken, query, selectedArea]);
  useEffect(() => () => { selectionRequest.current += 1; }, []);

  async function selectArea(area: AdministrativeArea): Promise<void> {
    const request = ++selectionRequest.current;
    setBusy(true); setError(undefined); setAreas([]);
    setSelectedArea(area); setQuery(area.name);
    try {
      const boundary = await getAdministrativeAreaBoundary(accessToken, area.id);
      if (request !== selectionRequest.current) return;
      if (!boundary.features.length) throw new Error("This GN Division has no available boundary.");
      onBoundaryChange({ type: "FeatureCollection", truncated: false, features: boundary.features.map((feature) => ({
        type: "Feature",
        geometry: feature.geometry as MapBoundaryFeatureCollection["features"][number]["geometry"],
        properties: { id: feature.properties.id, name: feature.properties.name, officialCode: feature.properties.officialCode, status: "ACTIVE" },
      })) });
    } catch (reason) {
      if (request === selectionRequest.current) {
        setError(describeApiFailure(reason, "Unable to load the GN Division boundary.").message);
      }
    } finally { if (request === selectionRequest.current) setBusy(false); }
  }

  function changeQuery(value: string) {
    selectionRequest.current += 1;
    setQuery(value); setSelectedArea(undefined); setAreas([]); setBusy(false); setError(undefined);
    onBoundaryChange(undefined);
  }

  return <div className="eco-area-search">
    <label>Find a GN Division<input value={query} onChange={(event) => changeQuery(event.target.value)} placeholder="Search GN Division, DS Division, district, or code" /></label>
    {selectedArea && <button type="button" className="eco-area-search-clear" onClick={() => changeQuery("")}>Clear GN Division</button>}
    {busy && <small role="status">{selectedArea ? "Loading boundary…" : "Searching…"}</small>}
    {error && <small role="alert">{error}</small>}
    {error && selectedArea && <button type="button" className="eco-area-search-clear" disabled={busy} onClick={() => void selectArea(selectedArea)}>Retry GN boundary</button>}
    {!selectedArea && areas.length > 0 && <div className="eco-area-search-results">{areas.slice(0, 8).map((area) =>
      <button type="button" key={area.id} onClick={() => void selectArea(area)}><strong>{area.name}</strong><span>{[area.divisionalSecretariatName, area.districtName, area.officialCode].filter(Boolean).join(" · ")}</span></button>
    )}</div>}
  </div>;
}
