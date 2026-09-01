import { useEffect, useState } from "react";
import { describeApiFailure } from "../../api/apiError";
import { getAdministrativeAreaBoundary, listAdministrativeAreas } from "../organizations/application/organizationApplication.api";
import type { AdministrativeArea } from "../organizations/application/organizationApplication.types";
import type { MapBoundaryFeatureCollection } from "./map.types";

type Props = { accessToken: string; onBoundaryChange: (boundary: MapBoundaryFeatureCollection | undefined) => void };

export function AdministrativeAreaMapSearch({ accessToken, onBoundaryChange }: Props) {
  const [query, setQuery] = useState("");
  const [areas, setAreas] = useState<AdministrativeArea[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (query.trim().length < 2) return;
    let active = true;
    const timeout = window.setTimeout(() => {
      setBusy(true); setError(undefined);
      void listAdministrativeAreas(accessToken, query).then((value) => { if (active) setAreas(value); }).catch((reason) => { if (active) setError(describeApiFailure(reason, "Unable to search GN Divisions.").message); }).finally(() => { if (active) setBusy(false); });
    }, 300);
    return () => { active = false; window.clearTimeout(timeout); };
  }, [accessToken, query]);

  async function selectArea(area: AdministrativeArea): Promise<void> {
    setBusy(true); setError(undefined);
    try {
      const boundary = await getAdministrativeAreaBoundary(accessToken, area.id);
      onBoundaryChange({ type: "FeatureCollection", truncated: false, features: boundary.features.map((feature) => ({
        type: "Feature",
        geometry: feature.geometry as MapBoundaryFeatureCollection["features"][number]["geometry"],
        properties: { id: feature.properties.id, name: feature.properties.name, officialCode: feature.properties.officialCode, status: "ACTIVE" },
      })) });
      setQuery(area.name); setAreas([]);
    } catch (reason) { setError(describeApiFailure(reason, "Unable to load the GN Division boundary.").message); }
    finally { setBusy(false); }
  }

  return <div className="eco-area-search"><label>Find a GN Division<input value={query} onChange={(event) => { setQuery(event.target.value); setAreas([]); onBoundaryChange(undefined); }} placeholder="Search GN Division, DS Division, district, or code" /></label>{busy && <small>Searching…</small>}{error && <small role="alert">{error}</small>}{query.trim().length >= 2 && areas.length > 0 && <div className="eco-area-search-results">{areas.slice(0, 8).map((area) => <button type="button" key={area.id} onClick={() => void selectArea(area)}><strong>{area.name}</strong><span>{[area.divisionalSecretariatName, area.districtName, area.officialCode].filter(Boolean).join(" · ")}</span></button>)}</div>}</div>;
}
