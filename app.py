"""QuakeAware - Personal Earthquake Risk & Preparedness Assistant.

Uses only free/open data (no API keys required):
  - OpenStreetMap Nominatim  -> geocoding (address -> lat/lon)
  - USGS Earthquake Catalog  -> historical + recent seismicity
A small curated fault-line dataset is bundled for proximity estimates.
"""
from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone

import requests
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

USGS_URL = "https://earthquake.usgs.gov/fdsnws/event/1/query"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
HEADERS = {"User-Agent": "QuakeAware/1.0 (portfolio project)"}

# Representative points along major/active fault systems worldwide.
# Distance to the nearest of these is a rough tectonic-exposure proxy.
FAULTS = [
    ("San Andreas Fault (USA)", 36.0, -120.5),
    ("Cascadia Subduction Zone (USA/Canada)", 45.5, -124.5),
    ("New Madrid Seismic Zone (USA)", 36.5, -89.5),
    ("Hayward Fault (USA)", 37.8, -122.2),
    ("North Anatolian Fault (Turkey)", 40.7, 31.0),
    ("East Anatolian Fault (Turkey)", 38.3, 38.5),
    ("Dead Sea Transform (Middle East)", 31.5, 35.5),
    ("Zagros Fault (Iran)", 33.0, 48.0),
    ("Main Himalayan Thrust (India/Nepal)", 28.2, 84.0),
    ("Chaman Fault (Pakistan/Afghanistan)", 30.5, 66.5),
    ("Sagaing Fault (Myanmar)", 21.0, 96.0),
    ("Sumatran Fault (Indonesia)", -0.5, 100.5),
    ("Philippine Fault (Philippines)", 13.0, 123.0),
    ("Median Tectonic Line (Japan)", 34.0, 135.0),
    ("Japan Trench (Japan)", 38.5, 143.0),
    ("Alpine Fault (New Zealand)", -43.5, 170.2),
    ("Nazca-South America (Chile/Peru)", -25.0, -70.5),
    ("Motagua Fault (Central America)", 15.2, -90.0),
    ("Denali Fault (Alaska)", 63.0, -147.0),
    ("Apennines Faults (Italy)", 42.5, 13.3),
    ("Hellenic Arc (Greece)", 35.5, 24.0),
]


def haversine(lat1, lon1, lat2, lon2):
    """Great-circle distance in km."""
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def geocode(query):
    r = requests.get(
        NOMINATIM_URL,
        params={"q": query, "format": "json", "limit": 1},
        headers=HEADERS,
        timeout=15,
    )
    r.raise_for_status()
    data = r.json()
    if not data:
        return None
    top = data[0]
    return {
        "lat": float(top["lat"]),
        "lon": float(top["lon"]),
        "name": top.get("display_name", query),
    }


def fetch_quakes(lat, lon, radius_km, years):
    start = (datetime.now(timezone.utc) - timedelta(days=365 * years)).strftime("%Y-%m-%d")
    r = requests.get(
        USGS_URL,
        params={
            "format": "geojson",
            "latitude": lat,
            "longitude": lon,
            "maxradiuskm": radius_km,
            "starttime": start,
            "minmagnitude": 2.5,
            "orderby": "time",
            "limit": 500,
        },
        headers=HEADERS,
        timeout=30,
    )
    r.raise_for_status()
    feats = r.json().get("features", [])
    quakes = []
    for f in feats:
        p = f["properties"]
        c = f["geometry"]["coordinates"]  # [lon, lat, depth]
        if p.get("mag") is None:
            continue
        quakes.append(
            {
                "mag": round(float(p["mag"]), 1),
                "place": p.get("place", "Unknown"),
                "time": datetime.fromtimestamp(p["time"] / 1000, timezone.utc).strftime("%Y-%m-%d"),
                "depth": round(float(c[2]), 1),
                "lat": c[1],
                "lon": c[0],
                "dist": round(haversine(lat, lon, c[1], c[0]), 1),
                "url": p.get("url", ""),
            }
        )
    return quakes


def nearest_fault(lat, lon):
    best = min(FAULTS, key=lambda f: haversine(lat, lon, f[1], f[2]))
    return {"name": best[0], "dist": round(haversine(lat, lon, best[1], best[2]), 0)}


def score(quakes, fault_dist, years):
    """Return (0-100 risk score, level label, contributing factors)."""
    if not quakes:
        base = 0.0
    else:
        # Energy-weighted: higher magnitudes dominate; normalise per year.
        energy = sum(10 ** (q["mag"] - 4) for q in quakes) / max(years, 1)
        max_mag = max(q["mag"] for q in quakes)
        freq = len(quakes) / max(years, 1)
        base = min(60, energy * 4) + min(25, (max_mag - 3) * 6) + min(15, freq * 3)

    # Fault proximity bonus (closer = higher).
    if fault_dist < 50:
        fbonus = 20
    elif fault_dist < 150:
        fbonus = 12
    elif fault_dist < 400:
        fbonus = 5
    else:
        fbonus = 0

    total = max(0, min(100, round(base + fbonus)))
    if total >= 70:
        level = "Very High"
    elif total >= 45:
        level = "High"
    elif total >= 25:
        level = "Moderate"
    elif total >= 10:
        level = "Low"
    else:
        level = "Very Low"
    return total, level


def checklist(level):
    base = [
        "Keep a 3-day emergency kit: water (4L/person/day), food, flashlight, first-aid.",
        "Store a battery/hand-crank radio and spare phone battery.",
        "Agree on a family meeting point and an out-of-area contact.",
        "Know how to shut off gas, water, and electricity.",
    ]
    more = {
        "Moderate": [
            "Secure tall furniture, water heaters, and heavy shelves to walls.",
            "Practice Drop, Cover, and Hold On with your household.",
        ],
        "High": [
            "Secure furniture and appliances to wall studs.",
            "Practice Drop, Cover, Hold On monthly; identify safe spots per room.",
            "Keep sturdy shoes and a flashlight by every bed.",
            "Review your building's seismic standard / retrofit status.",
        ],
        "Very High": [
            "Bolt heavy furniture, water heaters, and cabinets to studs.",
            "Consider earthquake insurance and a professional retrofit assessment.",
            "Keep kits at home, work, and in the car.",
            "Plan for utility loss lasting days; store extra water and cash.",
            "Learn your area's tsunami zone if near the coast.",
        ],
    }
    extra = []
    if level == "Moderate":
        extra = more["Moderate"]
    elif level == "High":
        extra = more["High"]
    elif level == "Very High":
        extra = more["High"] + more["Very High"]
    return base + extra


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/analyze")
def analyze():
    address = request.args.get("address", "").strip()
    lat = request.args.get("lat")
    lon = request.args.get("lon")
    years = int(request.args.get("years", 30))
    radius = int(request.args.get("radius", 200))

    try:
        if lat and lon:
            lat, lon = float(lat), float(lon)
            place = f"{lat:.3f}, {lon:.3f}"
        elif address:
            g = geocode(address)
            if not g:
                return jsonify({"error": "Location not found. Try a city or full address."}), 404
            lat, lon, place = g["lat"], g["lon"], g["name"]
        else:
            return jsonify({"error": "Provide an address or coordinates."}), 400

        quakes = fetch_quakes(lat, lon, radius, years)
        fault = nearest_fault(lat, lon)
        total, level = score(quakes, fault["dist"], years)
        largest = max(quakes, key=lambda q: q["mag"]) if quakes else None

        return jsonify(
            {
                "place": place,
                "lat": lat,
                "lon": lon,
                "years": years,
                "radius": radius,
                "score": total,
                "level": level,
                "fault": fault,
                "count": len(quakes),
                "largest": largest,
                "quakes": quakes,
                "checklist": checklist(level),
            }
        )
    except requests.RequestException:
        return jsonify({"error": "A data service is unavailable. Please try again."}), 502
    except Exception as e:  # noqa: BLE001
        return jsonify({"error": f"Unexpected error: {e}"}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)
