import type { IncidentDetail } from "./incident.types";
import "./citizenIncidentDiscovery.css";

export function IncidentEvidence({ incident, awaitingCleanup = false }: { incident: IncidentDetail; awaitingCleanup?: boolean }) {
  return (
    <article className="citizen-discovery-detail incident-evidence-card" aria-label="Incident details">
      <span>Incident</span>
      <h2>{incident.title}</h2>
      <p>{incident.description}</p>
      <p>{incident.category.name} &middot; {incident.severity.toLowerCase()}</p>
      {incident.addressText && <p>{incident.addressText}</p>}
      {awaitingCleanup && <p>{incident.status === "CLEANUP_ORGANIZED" ? "A cleanup has been organized. Refresh to see current activity." : "No cleanup event created yet."}</p>}
      <div className="citizen-discovery-evidence">
        {incident.photos.map(photo => (
          <figure key={photo.id}>
            <a href={photo.url} target="_blank" rel="noreferrer"><img src={photo.url} alt={photo.caption || "Incident evidence"} loading="lazy" /></a>
            {photo.caption && <figcaption>{photo.caption}</figcaption>}
          </figure>
        ))}
      </div>
    </article>
  );
}
