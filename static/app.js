let map, layer;
const LEVEL_COLOR = {
  "Very Low": "#22c55e", "Low": "#84cc16", "Moderate": "#eab308",
  "High": "#f97316", "Very High": "#ef4444",
};
const $ = (id) => document.getElementById(id);

function setStatus(msg) { $("status").textContent = msg || ""; }

async function analyze(params) {
  setStatus("Fetching seismic data…");
  $("go").disabled = true;
  try {
    const res = await fetch("/api/analyze?" + new URLSearchParams(params));
    const data = await res.json();
    if (!res.ok) { setStatus(data.error || "Something went wrong."); return; }
    render(data);
    if (window.QA) window.QA.focusOn(data.lat, data.lon);
    setStatus("");
  } catch (e) {
    setStatus("Network error — is the server running?");
  } finally {
    $("go").disabled = false;
  }
}

function render(d) {
  $("results").classList.remove("hidden");
  const color = LEVEL_COLOR[d.level] || "#38bdf8";

  // Gauge
  const deg = (d.score / 100) * 360;
  $("gauge").style.background = `conic-gradient(${color} ${deg}deg, var(--line) ${deg}deg)`;
  $("score").textContent = d.score;
  $("level").textContent = d.level + " risk";
  $("level").style.color = color;
  $("place").textContent = d.place;

  // Stats
  $("count").textContent = d.count;
  $("largest").textContent = d.largest ? "M" + d.largest.mag : "—";
  $("fault").textContent = d.fault.dist;
  $("faultname").textContent = "Nearest mapped fault system: " + d.fault.name;

  // Checklist
  $("checklist").innerHTML = d.checklist.map((c) => `<li>${c}</li>`).join("");

  // Recent list (top 12 by recency)
  $("recent").innerHTML = d.quakes.length
    ? d.quakes.slice(0, 12).map((q) => `
        <li>
          <span class="m">M${q.mag}</span>
          <a href="${q.url}" target="_blank" rel="noopener">${q.place}</a>
          <small>${q.time} · ${q.dist} km · ${q.depth} km deep</small>
        </li>`).join("")
    : "<li>No M2.5+ quakes recorded in this window. That's good news.</li>";

  drawMap(d, color);
}

function drawMap(d, color) {
  if (!map) {
    map = L.map("map");
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap", maxZoom: 18,
    }).addTo(map);
  }
  if (layer) map.removeLayer(layer);
  layer = L.layerGroup().addTo(map);

  L.circleMarker([d.lat, d.lon], {
    radius: 8, color: "#fff", weight: 2, fillColor: color, fillOpacity: 1,
  }).addTo(layer).bindPopup("<b>Your location</b><br>" + d.place);

  L.circle([d.lat, d.lon], {
    radius: d.radius * 1000, color: color, weight: 1, fillOpacity: 0.05,
  }).addTo(layer);

  d.quakes.forEach((q) => {
    L.circleMarker([q.lat, q.lon], {
      radius: Math.max(3, q.mag * 1.8),
      color: "#f97316", weight: 1, fillColor: "#f97316", fillOpacity: 0.5,
    }).addTo(layer).bindPopup(`<b>M${q.mag}</b> — ${q.place}<br>${q.time} · ${q.depth} km deep`);
  });

  map.setView([d.lat, d.lon], d.radius > 300 ? 5 : 6);
}

const skip = $("skip");
if (skip) skip.addEventListener("click", () => window.QA && window.QA.enter());

$("go").addEventListener("click", () => {
  const address = $("address").value.trim();
  if (!address) { setStatus("Type a city or address first."); return; }
  analyze({ address, radius: $("radius").value, years: $("years").value });
});

$("address").addEventListener("keydown", (e) => { if (e.key === "Enter") $("go").click(); });

$("locate").addEventListener("click", () => {
  if (!navigator.geolocation) { setStatus("Geolocation not supported."); return; }
  setStatus("Getting your location…");
  navigator.geolocation.getCurrentPosition(
    (pos) => analyze({
      lat: pos.coords.latitude, lon: pos.coords.longitude,
      radius: $("radius").value, years: $("years").value,
    }),
    () => setStatus("Location permission denied — type an address instead.")
  );
});
