"use client";

import { useEffect, useRef, useState } from "react";
import type { HomeState, ToHome } from "@homeboard/core/protocol";

// /casa è una vista: tutto arriva da brain sul Pi, via WebSocket locale. Senza brain resta l'ultimo stato visto
// (salvato qui), segnato come "senza segnale", e si riprova a collegarsi con attese crescenti.
// Indirizzo: ws://127.0.0.1:8765, oppure /casa?brain=ws://… (per il simulatore su un'altra porta o macchina).
const DEFAULT_URL = "ws://127.0.0.1:8765";
const CACHE = "hb:casa:state";

export function useBrain(onLevel: (level: number | null) => void) {
  const [state, setState] = useState<HomeState | null>(() => {
    try { return JSON.parse(localStorage.getItem(CACHE) ?? "null"); } catch { return null; }
  });
  const [connected, setConnected] = useState(false);
  const level = useRef(onLevel);
  useEffect(() => { level.current = onLevel; });

  useEffect(() => {
    const url = new URLSearchParams(location.search).get("brain") ?? DEFAULT_URL;
    let ws: WebSocket | undefined, retry: ReturnType<typeof setTimeout> | undefined, wait = 500, closed = false;
    const connect = () => {
      ws = new WebSocket(url);
      ws.onopen = () => { wait = 500; setConnected(true); };
      ws.onmessage = (e) => {
        const msg = JSON.parse(String(e.data)) as ToHome;
        if (msg.type === "level") return level.current(msg.value);
        setState(msg.state);
        try { localStorage.setItem(CACHE, JSON.stringify(msg.state)); } catch {}
      };
      ws.onclose = () => {
        setConnected(false);
        level.current(null);
        if (!closed) retry = setTimeout(connect, (wait = Math.min(wait * 2, 10_000)));
      };
    };
    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      ws?.close();
    };
  }, []);

  return { state, connected };
}
