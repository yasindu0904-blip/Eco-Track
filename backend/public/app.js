const resultText = document.getElementById("resultText");
const lookupButton = document.getElementById("lookup");
const latitudeInput = document.getElementById("latitude");
const longitudeInput = document.getElementById("longitude");

const map = L.map("map").setView([6.85, 79.9], 11);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors",
  maxZoom: 19,
}).addTo(map);

let marker;
let boundaryLayer;

function showResult(message) {
  resultText.textContent = message;
}

showResult("OpenStreetMap loaded. Enter coordinates and click Lookup.");

async function lookupCoordinate() {
  const latitude = Number(latitudeInput.value);
  const longitude = Number(longitudeInput.value);

  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    showResult("Latitude and longitude must be valid numbers.");
    return;
  }

  showResult("Looking up DS division...");

  try {
    const response = await fetch("/api/lookup-ds-division", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude, longitude }),
    });

    const payload = await response.json();
    if (!response.ok) {
      showResult(payload.error || "Lookup failed.");
      return;
    }

    const title = `${payload.dsDivisionName}, ${payload.districtName}, ${payload.provinceName}`;
    showResult(`DS division: ${title}`);

    if (marker) map.removeLayer(marker);
    if (boundaryLayer) map.removeLayer(boundaryLayer);

    marker = L.marker([latitude, longitude])
      .addTo(map)
      .bindPopup(title)
      .openPopup();

    boundaryLayer = L.geoJSON(payload.geojson, {
      style: {
        color: "#ff6600",
        weight: 3,
        fillColor: "#ffcc99",
        fillOpacity: 0.3,
      },
    }).addTo(map);

    const bounds = boundaryLayer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [20, 20] });
    } else {
      map.setView([latitude, longitude], 14);
    }
  } catch (error) {
    console.error(error);
    showResult("Could not connect to the lookup service.");
  }
}

lookupButton.addEventListener("click", lookupCoordinate);
