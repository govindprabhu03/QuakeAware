# 🌍 QuakeAware

**Know your earthquake risk — with data, not guesswork.**

Type any city or address and get a plain-language earthquake risk profile: a 0–100
risk score, recent significant quakes nearby on a map, distance to the nearest major
fault system, and a preparedness checklist scaled to your risk level.

Built as a portfolio project. Uses **only free, open data — no API keys required.**

![Python](https://img.shields.io/badge/Python-3.12-blue) ![Flask](https://img.shields.io/badge/Flask-3.0-green)

## Features
- 🔎 **Address or GPS lookup** (OpenStreetMap Nominatim geocoding).
- 📊 **Real seismic history** from the USGS Earthquake Catalog (M2.5+).
- 🧮 **Energy-weighted risk score** combining quake magnitude, frequency, and fault proximity.
- 🗺️ **Interactive Leaflet map** of nearby quakes sized by magnitude.
- ✅ **Tailored preparedness checklist** that grows with your risk level.

## Data sources
| Data | Source | Key needed |
|------|--------|-----------|
| Geocoding | OpenStreetMap Nominatim | No |
| Earthquakes | USGS FDSN Event API | No |
| Fault proximity | Bundled curated dataset of major fault systems | No |

## Run it locally
```bash
pip install -r requirements.txt
python app.py
```
Then open http://localhost:5000 and try `Tokyo, Japan`, `San Francisco`, or `London`.

## How the risk score works
1. Fetch all M2.5+ quakes within your chosen radius over the chosen number of years.
2. Compute an **energy term** (`10^(mag-4)` summed, per year) so big quakes dominate,
   plus terms for the largest magnitude and the annual frequency.
3. Add a **fault-proximity bonus** based on distance to the nearest mapped fault system.
4. Clamp to 0–100 and bucket into Very Low → Very High.

## Project structure
```
QuakeAware/
├── app.py              # Flask backend + risk logic
├── requirements.txt
├── templates/
│   └── index.html
└── static/
    ├── style.css
    └── app.js
```

## Disclaimer
Risk scores are **educational estimates**, not an official seismic-hazard assessment.
For authoritative hazard data consult your national geological survey (e.g. USGS).
