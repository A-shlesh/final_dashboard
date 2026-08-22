# SCRUB Command Center — Environmental Intelligence & Basin Observatory

SCRUB is a high-performance environmental water quality intelligence and autonomous surface robot command center designed for lake observation, reclamation tracking, and in-situ multi-sensor telemetry surveillance.

---

## System Architecture

```text
+-----------------------------------------------------------------------------+
|                                 IOT HARDWARE                                |
|  [ESP32 / Arduino + Sensors]  --->  [Raspberry Pi / 4G LTE Gateway]        |
|  - GPS (NEO-6M / Ublox)             - Python Serial/Camera Bridge           |
|  - Analog pH Probe                  - Video Streaming Server (:5000)        |
|  - TDS Sensor (ppm)                 - Serial telemetry bridge               |
|  - Turbidity Sensor (NTU)                                                   |
|  - DHT22 (Temp & Humidity)                                                  |
|  - MQ-135 (Air Quality / Gas)                                               |
+------------------------------------+----------------------------------------+
                                     |
                +--------------------+--------------------+
                |                                         |
                v (Cloud Sync)                            v (Local HTTP)
     +-----------------------+                 +-----------------------+
     |   FIREBASE REALTIME   |                 |    RASPBERRY PI       |
     |   DATABASE / FIRESTORE|                 |    LOCAL BRIDGE       |
     |   (REST / SDK Stream) |                 |    (JSON Endpoint)    |
     +-----------+-----------+                 +-----------+-----------+
                 |                                         |
                 +--------------------+--------------------+
                                      |
                                      v
+-----------------------------------------------------------------------------+
|                          SCRUB WEB COMMAND CENTER                           |
|                                                                             |
|  +-----------------------------------------------------------------------+  |
|  | OpenStreetMap & Satellite Basemap Workspace                           |  |
|  | - Real Water Body Boundary Polygon Rendering                          |  |
|  | - Dynamic Uniform Survey Grids Generation                             |  |
|  | - Live Robot GPS Coordinate Tracking & Heading Compass Marker        |  |
|  | - Multi-Parameter Heatmap Overlay (TDS, Turbidity, pH, Temp, WQI)     |  |
|  +-----------------------------------------------------------------------+  |
|                                                                             |
|  +-----------------------------------------------------------------------+  |
|  | Real-Time Surveillance & Analysis Engines                             |  |
|  | - Live RPi Video Streamer (:5000/video_feed) with POV HUD Overlay     |  |
|  | - Basin Water Health Analytics & Multi-Lake Comparison Table          |  |
|  | - Critical Threat & Anomaly Surveillance with 1-Click Hotspot Flight  |  |
|  | - Area-based OpenStreetMap Geocoding Search (Nominatim API)           |  |
|  +-----------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------+
```

---

## Core Capabilities

### 1. Real-Time Cloud Telemetry (Firebase Integration)
- Connects directly to **Firebase Realtime Database (RTDB)**, **Firestore**, and **Firebase REST API**.
- Subscribes to real-time telemetry packets and automatically extracts:
  - **Live GPS coordinates** (`latitude`, `longitude`) to reposition the robot marker on the map in real-time.
  - **Water & Air quality sensors**: TDS, Turbidity, Analog pH, Ambient Temperature, Humidity, and MQ-135 Gas index.
  - Automatically identifies whether the GPS position is inside a registered water body and highlights the corresponding grid sector.

### 2. Multi-Parameter Lake Grid Heatmap
- Visualizes spatial water quality variations across generated survey grids:
  - **Status Mode**: Cleaned, Active, Untouched survey sectors.
  - **TDS Mode**: Total Dissolved Solids gradient (Cyan < 250 ppm, Emerald 250-350 ppm, Amber 350-500 ppm, Crimson > 500 ppm).
  - **Turbidity Mode**: Water clarity gradient (Cyan < 8 NTU, Emerald 8-15 NTU, Amber 15-25 NTU, Crimson > 25 NTU).
  - **pH Mode**: Acidity/alkalinity scale (Rose < 6.5, Emerald 6.5-7.6, Cyan 7.6-8.5, Purple > 8.5).
  - **Temp Mode**: Thermal distribution (Cyan < 24°C, Emerald 24-28°C, Amber 28-32°C, Crimson > 32°C).
  - **WQI Mode**: Overall Water Quality Index (Emerald 80-100, Cyan 60-79, Amber 40-59, Crimson < 40).
- Includes an on-map interactive parameter selector and scale legend HUD.

### 3. Live Raspberry Pi Camera Video Stream & POV HUD
- Real-time video player supporting MJPEG camera streams from `http://<pi_ip>:5000/video_feed`.
- Overlay HUD displaying artificial horizon, compass heading, GPS coordinates, live sensor status, and latency.
- High-fidelity procedural wave simulation fallback for bench testing when physical camera is offline.
- 1-click snapshot tool saving video frame and telemetry overlay to PNG.

### 4. Basin Health Analytics & Threat Surveillance
- **Analytics Engine**: Aggregates lake data to compute mean Basin Health Index (WQI), surveyed hectares, and reclamation percentages against environmental safety standards.
- **Threat Surveillance**: Continuous anomaly detection for critical turbidity breaches (> 25 NTU), chemical pH imbalances (< 6.4 or > 8.6), and elevated TDS (> 500 ppm) with a 1-click "Locate Hotspot" map flight.

### 5. Maps-Style Geocoding Search & Keyboard Navigation
- OpenStreetMap Nominatim live geocoding search for jumping to any neighborhood, landmark, or water body.
- Full keyboard arrow navigation (`ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`, `Enter`, `Escape`) across all top bar buttons, modal forms, and search dropdowns.

---

## Hardware Telemetry JSON Schema

Ensure your Arduino / ESP32 or Raspberry Pi publishes JSON payloads matching this schema to Firebase or the local REST bridge:

```json
{
  "timestamp": 1724061000,
  "latitude": 12.9250,
  "longitude": 77.5850,
  "compass": 180,
  "tds": 412.5,
  "turbidity": 18.2,
  "ph": 7.34,
  "air_temperature": 31.4,
  "humidity": 68.2,
  "mq135": 35.0,
  "speed": 1.5,
  "satellites": 9
}
```

*Note: The parser is tolerant and automatically recognizes alternate keys such as `lat`, `lng`, `lon`, `temp`, `ntu`, `gas`, and `heading`.*

---

## Environment Configuration

Create or update the `.env` file in the root directory:

```ini
# Map Configuration
VITE_LOVABLE_CONNECTOR_MAPBOX_PUBLIC_TOKEN=pk.your_mapbox_public_token_here

# Firebase Cloud Telemetry Configuration
VITE_FIREBASE_API_KEY=your_firebase_web_api_key_here
VITE_FIREBASE_DATABASE_URL=https://your-project-id-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_TELEMETRY_PATH=telemetry
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
```

*Credentials can also be configured dynamically in the dashboard via the **Gateway Settings** modal without editing code.*

---

## Local Development & Setup

### Prerequisites
- Node.js 18+ or 20+
- Python 3.8+ (for Raspberry Pi bridge script)

### 1. Install Frontend Dependencies
```bash
npm install
```

### 2. Start Web Command Center
```bash
npm run dev -- --port 8081
```
Open [http://localhost:8081](http://localhost:8081) in your browser.

### 3. Run Raspberry Pi Hardware Bridge (Optional for Local Mode)
On your Raspberry Pi connected to Arduino / USB camera:
```bash
pip install flask opencv-python pyserial
python raspberry_pi_bridge.py
```
This runs the HTTP JSON telemetry bridge on port `5000` and serves the MJPEG live video feed at `/video_feed`.

---

## Project Structure

```text
├── raspberry_pi_bridge.py        # Python serial/camera bridge for Raspberry Pi
├── src/
│   ├── components/
│   │   ├── live/
│   │   │   ├── analytics-modal.tsx       # Basin health metrics & lake ranking table
│   │   │   ├── clear-lake-modal.tsx      # Lake deletion modal with keyboard navigation
│   │   │   ├── detail-panel.tsx          # Real-time lake and grid sector telemetry HUD
│   │   │   ├── live-map.tsx              # Mapbox GL workspace, grid rendering, heatmap layers
│   │   │   ├── live-stream-hud.tsx       # Real-time telemetry ribbon HUD
│   │   │   ├── live-telemetry-modal.tsx  # Multi-channel sensor telemetry diagnostics modal
│   │   │   ├── live-video-panel.tsx      # Robot camera streamer & POV HUD overlay
│   │   │   ├── location-search-bar.tsx   # Geocoding location search with keyboard arrows
│   │   │   ├── map-hud.tsx               # Basemap switcher (Map / Satellite)
│   │   │   ├── pi-settings-modal.tsx     # Firebase Cloud & Pi Gateway configuration modal
│   │   │   ├── threats-modal.tsx         # Anomaly breach surveillance & 1-click hotspot flight
│   │   │   └── tools-panel.tsx           # Boundary modification tools
│   ├── lib/
│   │   ├── firebase-telemetry-service.ts # Firebase Realtime DB, Firestore, REST stream connector
│   │   ├── keyboard-nav.ts               # Arrow key navigation hooks for dashboard buttons
│   │   ├── osm-water-service.ts          # OpenStreetMap shoreline boundary detection
│   │   ├── robot-telemetry-service.ts    # Universal hardware JSON packet parser & REST client
│   │   ├── water-analytics.ts            # WQI calculation and standard threshold evaluators
│   │   └── water-data.ts                 # Lake entities, grid generators, color constants
│   ├── routes/
│   │   └── index.tsx                     # Main Command Center Route and primary layout
└── package.json
```

---

## License
MIT License. Built for environmental surveillance and water body conservation.
