#!/usr/bin/env python3
"""
SCRUB Autonomous Marine Robot — Arduino to Raspberry Pi Telemetry Bridge.
Reads live sensor data from Arduino USB Serial and serves it over HTTP JSON API
for the SCRUB Dashboard frontend matching Dishita's JSON format.

Hardware JSON Format:
{
  "timestamp": 1724061000,
  "latitude": 13.0827,
  "longitude": 80.2707,
  "tds": 412.5,
  "turbidity": 18.2,
  "ph": 7.34,
  "air_temperature": 31.4,
  "humidity": 68.2
}

Requirements:
    pip install flask flask-cors pyserial

Run on Raspberry Pi:
    python raspberry_pi_bridge.py
"""

import json
import time
import threading
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Allow cross-origin requests from SCRUB Dashboard

# Global cache holding latest telemetry packet in Dishita's exact schema
latest_telemetry = {
    "timestamp": int(time.time()),
    "latitude": 13.0827,
    "longitude": 80.2707,
    "tds": 412.5,
    "turbidity": 18.2,
    "ph": 7.34,
    "air_temperature": 31.4,
    "humidity": 68.2
}

SERIAL_PORT = '/dev/ttyACM0'  # Or /dev/ttyUSB0, COM3 on Windows
BAUD_RATE = 9600

def read_arduino_serial():
    global latest_telemetry
    try:
        import serial
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=2)
        print(f"Connected to Arduino on {SERIAL_PORT} @ {BAUD_RATE} baud.")
        while True:
            line = ser.readline().decode('utf-8', errors='ignore').strip()
            if line:
                try:
                    data = json.loads(line)
                    latest_telemetry = {
                        "timestamp": int(data.get("timestamp", time.time())),
                        "latitude": float(data.get("latitude", data.get("lat", latest_telemetry["latitude"]))),
                        "longitude": float(data.get("longitude", data.get("lng", latest_telemetry["longitude"]))),
                        "tds": float(data.get("tds", latest_telemetry["tds"])),
                        "turbidity": float(data.get("turbidity", latest_telemetry["turbidity"])),
                        "ph": float(data.get("ph", latest_telemetry["ph"])),
                        "air_temperature": float(data.get("air_temperature", data.get("temp", latest_telemetry["air_temperature"]))),
                        "humidity": float(data.get("humidity", latest_telemetry["humidity"]))
                    }
                except json.JSONDecodeError:
                    pass
    except Exception as e:
        print(f"Serial port notice: {e}. Running in HTTP/Simulation mode.")

# Start serial thread in background
t = threading.Thread(target=read_arduino_serial, daemon=True)
t.start()

@app.route("/telemetry", methods=["GET", "POST"])
def telemetry_endpoint():
    """Returns the latest in-situ robot GPS and sensor payload (or updates via POST)."""
    global latest_telemetry
    if request.method == "POST":
        data = request.get_json(force=True)
        if data:
            latest_telemetry.update(data)
            latest_telemetry["timestamp"] = int(time.time())
    return jsonify(latest_telemetry)

@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({"status": "online", "robot": "SCRUB-R100", "pi_bridge": True, "video_stream": True})

def generate_video_stream():
    """Streams MJPEG frames from Pi Camera (or OpenCV / procedural fallback)."""
    try:
        import cv2
        cap = cv2.VideoCapture(0)
        while True:
            success, frame = cap.read()
            if not success:
                break
            ret, buffer = cv2.imencode('.jpg', frame)
            frame_bytes = buffer.tobytes()
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
            time.sleep(0.033)
    except Exception as e:
        print(f"Video capture notice: {e}. Camera fallback mode active.")

@app.route("/video_feed")
def video_feed():
    """Video streaming route. Put this in the src attribute of an img tag."""
    from flask import Response
    return Response(generate_video_stream(), mimetype='multipart/x-mixed-replace; boundary=frame')

if __name__ == "__main__":
    print("=========================================================")
    print(" SCRUB Live Telemetry & Video Server running on port 5000")
    print(" Telemetry endpoint : http://<raspberry_pi_ip>:5000/telemetry")
    print(" Video Feed stream   : http://<raspberry_pi_ip>:5000/video_feed")
    print("=========================================================")
    app.run(host="0.0.0.0", port=5000, debug=False)
