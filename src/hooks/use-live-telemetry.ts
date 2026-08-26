import { useCallback, useEffect, useRef, useState } from "react";

// Backend telemetry payload shape (from BACKEND_README.md)
export type LiveTelemetry = {
  type: string;
  lat: number;
  lon: number;
  heading_deg: number;
  speed_mps: number;
  state: string;
  effective_mode: string;
  current_waypoint_index: number;
  total_waypoints: number;
  satellites: number;
  fix_quality: number;
  left_power: number;
  right_power: number;
  sensors: Record<string, number>;
  timestamp: number;
};

export type DwellSample = {
  type: "dwell_sample";
  mission_id: number;
  waypoint_index: number;
  sensors: Record<string, number>;
  timestamp: number;
};

export type ConnectionStatus = "connected" | "connecting" | "offline";

const DEFAULT_WS_URL = "ws://192.168.1.100:8000/ws";
const RECONNECT_BASE_MS = 3000;
const RECONNECT_MAX_MS = 30000;

export function getWsEndpoint(): string {
  try {
    return localStorage.getItem("scrub_ws_endpoint") || DEFAULT_WS_URL;
  } catch {
    return DEFAULT_WS_URL;
  }
}

export function saveWsEndpoint(url: string) {
  try {
    localStorage.setItem("scrub_ws_endpoint", url.trim());
  } catch {
    /* noop */
  }
}

export function useLiveTelemetry() {
  const [telemetry, setTelemetry] = useState<LiveTelemetry | null>(null);
  const [dwellSample, setDwellSample] = useState<DwellSample | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("offline");

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef(RECONNECT_BASE_MS);
  const mountedRef = useRef(true);

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    cleanup();

    const url = getWsEndpoint();
    setConnectionStatus("connecting");

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setConnectionStatus("connected");
        reconnectDelayRef.current = RECONNECT_BASE_MS;
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "telemetry") {
            setTelemetry(msg as LiveTelemetry);
          } else if (msg.type === "dwell_sample") {
            setDwellSample(msg as DwellSample);
          }
        } catch {
          // malformed message, ignore
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setConnectionStatus("offline");
        wsRef.current = null;
        // Auto-reconnect with backoff
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectDelayRef.current = Math.min(
            reconnectDelayRef.current * 1.5,
            RECONNECT_MAX_MS,
          );
          connect();
        }, reconnectDelayRef.current);
      };

      ws.onerror = () => {
        // onclose will fire after onerror
      };
    } catch {
      setConnectionStatus("offline");
      reconnectTimeoutRef.current = setTimeout(connect, reconnectDelayRef.current);
    }
  }, [cleanup]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [connect, cleanup]);

  const sendCommand = useCallback((cmd: Record<string, unknown>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(cmd));
    }
  }, []);

  return { telemetry, dwellSample, connectionStatus, sendCommand };
}
