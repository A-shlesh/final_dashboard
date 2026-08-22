# SCRUB Command Center — Environmental Intelligence & Basin Observatory

> Real-time water quality monitoring dashboard for autonomous surface robots.
> Connects to **Firebase Realtime Database** live — no backend needed.

---

## ⚡ Quick Start (3 Steps)

```bash
# 1. Clone
git clone https://github.com/S-Farhan-Hashmi/final_dashboard.git
cd final_dashboard

# 2. Install dependencies
npm install

# 3. Run
npm run dev -- --port 8081
```

Open **http://localhost:8081** in your browser. That's it.

> **Firebase is pre-configured.** The dashboard connects to the `scrub-v4` Firebase project
> out of the box — no `.env` file required. If you want to use your own Firebase project,
> see [Using Your Own Firebase](#using-your-own-firebase).

---

## 🗺️ What You'll See

| Feature | Description |
|---|---|
| **Live Map** | OpenStreetMap + Satellite via Mapbox — click any real lake to detect its boundary |
| **Live Stream HUD** | Real-time sensor tiles (TDS · Turbidity · pH · Temp · Humidity · MQ-135) from Firebase |
| **Firebase Gateway** | Streams `sensorData/current` from Firebase RTDB with `onValue` listener |
| **Analytics Modal** | Basin Health Index, reclamation %, lake-level WQI aggregations |
| **Threats Modal** | Anomaly detection — turbidity > 25 NTU, pH out of range, TDS > 500 ppm |
| **Robot Camera** | MJPEG video stream from Raspberry Pi with POV HUD overlay |
| **Lake Management** | Register lakes from OSM boundary detection, generate survey grids |

---

## 📡 Live Firebase Pipeline

```
Raspberry Pi (Python bridge)
        ↓
Firebase Realtime Database
        ↓
  sensorData/current
  ├── tds_ppm          → TDS (ppm)
  ├── turbidity_ntu    → Turbidity (NTU)
  ├── ph               → pH
  ├── temperature      → Air Temperature (°C)
  ├── humidity         → Humidity (%)
  ├── mq135_ppm        → MQ-135 Gas (ppm)
  ├── status           → Status string
  └── timestamp_ms     → Timestamp (ms)
        ↓
Firebase RTDB SDK (onValue listener)
        ↓
Telemetry Parser (field mapping)
        ↓
Live Stream HUD + Telemetry Modal
```

### Testing the Firebase Connection

1. Click the **⚙️ gear icon** next to the Start button (top-right nav)
2. The **Firebase Cloud Sync** tab is pre-filled with the project credentials
3. Click **"Test Firebase"** — you should see live sensor values + raw Firebase node data
4. Click **Save & Connect**
5. Click the green **▶ Start** button
6. The **Live Stream HUD** appears on the map with live sensor values

---

## 🔥 Firebase Configuration

### Default Project (pre-configured, no setup needed)

```js
const firebaseConfig = {
  apiKey: "AIzaSyCZcUkgZGlVvZnm-BV4oiO8NZ4F7A8e9rU",
  authDomain: "scrub-v4.firebaseapp.com",
  databaseURL: "https://scrub-v4-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "scrub-v4",
  storageBucket: "scrub-v4.firebasestorage.app",
  messagingSenderId: "984022165050",
  appId: "1:984022165050:web:c1c1f232bb985816cab703"
};
```

**Telemetry path:** `sensorData/current`

### Firebase Security Rules

Your Firebase RTDB must allow public reads:

```json
{
  "rules": {
    ".read": true,
    ".write": false
  }
}
```

Go to **Firebase Console → scrub-v4 → Realtime Database → Rules → Publish**.

---

## 🔧 Using Your Own Firebase

### Option A — Via the Settings Modal (no code change needed)

1. Open **⚙️ Gateway Settings** in the dashboard
2. Switch to **Firebase Cloud Sync**
3. Fill in your API Key, Database URL, and Telemetry Path
4. Click **Test Firebase** to verify
5. Click **Save & Connect**

Settings are saved to `localStorage` and persist across reloads.

### Option B — Environment Variables (for team / CI use)

Copy `.env.example` → `.env` and fill in your values:

```bash
cp .env.example .env
```

```ini
VITE_FIREBASE_API_KEY=your_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=000000000000
VITE_FIREBASE_APP_ID=1:000000000000:web:xxxxxxxxxxxx
VITE_FIREBASE_TELEMETRY_PATH=sensorData/current
```

Then restart `npm run dev`.

> ⚠️ Never commit `.env` — it is already in `.gitignore`.

---

## 🍓 Raspberry Pi Hardware Bridge (Optional)

The Raspberry Pi sends sensor data to Firebase automatically. This script is only needed for **local HTTP mode** (when Firebase is not used):

```bash
# On the Raspberry Pi
pip install flask opencv-python pyserial
python raspberry_pi_bridge.py
```

This runs a local HTTP bridge on port `5000`:
- `GET /telemetry` — JSON sensor packet
- `GET /video_feed` — MJPEG camera stream

To switch the dashboard to local Pi mode:
1. Open **⚙️ Gateway Settings → Raspberry Pi Local**
2. Enter `http://<pi_ip>:5000/telemetry`
3. Click **Save & Connect**
4. Click **▶ Start**

---

## 🖥️ System Architecture

```
+─────────────────────── IOT HARDWARE ───────────────────────────────────+
│  ESP32 / Arduino + Sensors  ──→  Raspberry Pi (4G LTE Gateway)         │
│  - GPS (NEO-6M / Ublox)          - Python Serial Bridge                │
│  - Analog pH Probe                - Video Streaming Server (:5000)      │
│  - TDS Sensor (ppm)               - Publishes to Firebase RTDB          │
│  - Turbidity Sensor (NTU)                                               │
│  - DHT22 (Temp & Humidity)                                              │
│  - MQ-135 (Air Quality / Gas)                                           │
+─────────────────────────────────┬──────────────────────────────────────+
                                   │
               +───────────────────┴──────────────────+
               ↓                                       ↓
   Firebase Realtime Database              Raspberry Pi Local
   sensorData/current                      :5000/telemetry
   (real-time onValue listener)            (2s REST polling)
               └───────────────────┬──────────────────┘
                                   ↓
+──────────────────── SCRUB WEB COMMAND CENTER ──────────────────────────+
│  Mapbox GL Map + OSM Water Detection + Survey Grid Heatmaps            │
│  Live Stream HUD + Robot Marker + Telemetry Modal + Threat Alerts      │
+────────────────────────────────────────────────────────────────────────+
```

---

## 📦 Hardware Telemetry JSON Schema

The Raspberry Pi publishes this structure to `sensorData/current`:

```json
{
  "tds_ppm": 412.5,
  "turbidity_ntu": 18.2,
  "ph": 7.34,
  "temperature": 31.4,
  "humidity": 68.2,
  "mq135_ppm": 35.0,
  "status": "ok",
  "timestamp_ms": 1724061000000
}
```

The parser also accepts legacy field names:

| Legacy field | Firebase field | Dashboard field |
|---|---|---|
| `tds` | `tds_ppm` | `sensors.tds` |
| `turbidity` / `ntu` | `turbidity_ntu` | `sensors.turbidity` |
| `ph` | `ph` | `sensors.ph` |
| `air_temperature` / `temp` | `temperature` | `sensors.air_temperature` |
| `humidity` | `humidity` | `sensors.humidity` |
| `mq135` / `gas` | `mq135_ppm` | `sensors.mq135` |
| `timestamp` | `timestamp_ms` | `timestamp` |

**GPS note:** `sensorData/current` does not include GPS. The robot map marker stays at its last known position — no fake coordinates are used.

---

## 📁 Project Structure

```
scrub-dashboard/
├── .env.example                          # Copy to .env for custom Firebase config
├── raspberry_pi_bridge.py               # Python bridge for Raspberry Pi
└── src/
    ├── lib/
    │   ├── firebase-telemetry-service.ts # Firebase RTDB listener + test connection
    │   ├── robot-telemetry-service.ts    # Universal JSON parser (Firebase + legacy)
    │   ├── water-analytics.ts            # WQI calculations + IS:10500 thresholds
    │   ├── water-data.ts                 # Lake entities, grid generators
    │   ├── osm-water-service.ts          # OpenStreetMap Nominatim geocoding
    │   └── keyboard-nav.ts              # Arrow-key navigation hook
    ├── components/
    │   ├── live/
    │   │   ├── live-map.tsx              # Mapbox GL workspace + grid heatmap layers
    │   │   ├── live-stream-hud.tsx       # Real-time 6-channel sensor ribbon HUD
    │   │   ├── live-telemetry-modal.tsx  # Full sensor diagnostics modal
    │   │   ├── live-video-panel.tsx      # Robot MJPEG camera + POV overlay
    │   │   ├── pi-settings-modal.tsx     # Firebase + Pi gateway configuration
    │   │   ├── analytics-modal.tsx       # Basin health & lake ranking table
    │   │   ├── threats-modal.tsx         # Anomaly surveillance & hotspot flight
    │   │   ├── detail-panel.tsx          # Lake & grid sector telemetry HUD
    │   │   └── location-search-bar.tsx   # OSM geocoding search
    │   └── combined/
    │       └── kengeri-monitoring-suite.tsx  # Kengeri lake live monitoring
    └── routes/
        ├── index.tsx                     # Main Basin Observatory (primary route)
        └── ops.tsx                       # Mission Control / Ops view
```

---

## 🛠️ Troubleshooting

**Firebase says "PERMISSION_DENIED"**
Set Realtime Database rules to allow reads:
```json
{ "rules": { ".read": true, ".write": false } }
```

**Firebase says "No telemetry found at sensorData/current"**
- Check the Raspberry Pi bridge is running and publishing to Firebase
- Verify the path in **Gateway Settings** matches your DB structure
- Open **Firebase Console → scrub-v4 → Realtime Database** to confirm the node exists

**Map doesn't load / shows blank**
You need a Mapbox public token. Get one free at [mapbox.com](https://mapbox.com), then add to `.env`:
```
VITE_LOVABLE_CONNECTOR_MAPBOX_PUBLIC_TOKEN=pk.your_token_here
```

**"vite not recognized" on Windows**
Run with the full npm script:
```bash
npm run dev -- --port 8081
```

**Port already in use**
```bash
npm run dev -- --port 3000
```

---

## Prerequisites

- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **npm** (comes with Node)
- Python 3.8+ (only for Raspberry Pi bridge script)

---

## License

MIT License. Built for environmental surveillance and water body conservation.
