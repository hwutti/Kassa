"use client";

import { useEffect, useRef } from "react";

/**
 * Live-Aktualisierung via Server-Sent Events mit Polling-Fallback.
 * Ruft `onEvent` bei jeder Server-Änderung auf (nahezu sofort) und zusätzlich
 * regelmäßig als Sicherheitsnetz, falls die SSE-Verbindung abbricht.
 */
export function useLive(onEvent: () => void, fallbackMs = 15000) {
  const cb = useRef(onEvent);
  cb.current = onEvent;

  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/ereignisse");
      es.onmessage = () => cb.current();
    } catch {
      /* EventSource nicht verfügbar – Fallback-Polling greift */
    }
    const iv = window.setInterval(() => cb.current(), fallbackMs);
    return () => {
      es?.close();
      window.clearInterval(iv);
    };
  }, [fallbackMs]);
}
