"use client";

import { useEffect, useState } from "react";
import {
  setOnline,
  setUpdateWorker,
  updateAnwenden,
  usePwaStatus,
  istBestellungOffen,
} from "@/lib/pwa-store";

/**
 * Registriert den Service Worker, überwacht die Verbindung (navigator.onLine +
 * Health-Ping) und zeigt Verbindungs- sowie Update-Hinweise an.
 */
export function PwaController() {
  const { online, updateReady } = usePwaStatus();
  const [updateBlockiert, setUpdateBlockiert] = useState(false);

  // --- Service Worker registrieren + Updates erkennen ---
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    let reg: ServiceWorkerRegistration | undefined;

    const pruefeWartend = (r: ServiceWorkerRegistration) => {
      if (r.waiting && navigator.serviceWorker.controller) {
        setUpdateWorker(r.waiting);
      }
    };

    navigator.serviceWorker
      .register("/sw.js")
      .then((r) => {
        reg = r;
        pruefeWartend(r);
        r.addEventListener("updatefound", () => {
          const neu = r.installing;
          if (!neu) return;
          neu.addEventListener("statechange", () => {
            // Neuer Worker installiert und es gibt bereits einen Controller -> Update wartet.
            if (neu.state === "installed" && navigator.serviceWorker.controller) {
              setUpdateWorker(neu);
            }
          });
        });
      })
      .catch(() => undefined);

    // Regelmäßig nach Updates suchen (z. B. beim Zurückkehren zur App).
    const onFocus = () => reg?.update().catch(() => undefined);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  // --- Verbindungsüberwachung: navigator-Events + Health-Ping ---
  useEffect(() => {
    if (typeof window === "undefined") return;
    let aktiv = true;

    async function pruefeVerbindung() {
      if (!navigator.onLine) {
        if (aktiv) setOnline(false);
        return;
      }
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        if (aktiv) setOnline(res.ok);
      } catch {
        if (aktiv) setOnline(false);
      }
    }

    pruefeVerbindung();
    const interval = window.setInterval(pruefeVerbindung, 20000);
    const onOnline = () => pruefeVerbindung();
    const onOffline = () => setOnline(false);
    const onVisible = () => document.visibilityState === "visible" && pruefeVerbindung();
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      aktiv = false;
      window.clearInterval(interval);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  function updateKlick() {
    // Laufende Bestellung darf durch ein Update nicht zerstört werden.
    if (istBestellungOffen()) {
      setUpdateBlockiert(true);
      window.setTimeout(() => setUpdateBlockiert(false), 6000);
      return;
    }
    updateAnwenden();
  }

  return (
    <>
      {/* Verbindungs-Banner: deutlich sichtbar bei fehlender Verbindung. */}
      {!online && (
        <div
          role="status"
          className="fixed inset-x-0 top-0 z-50 bg-red-700 text-white text-center text-sm py-2 px-3 shadow-lg"
        >
          Keine Verbindung – neue Bestellungen können nicht abgeschlossen werden.
        </div>
      )}

      {/* Update-Banner: Aktivierung nur bewusst durch den Benutzer. */}
      {updateReady && (
        <div className="fixed inset-x-0 bottom-0 z-50 bg-brand-700 text-white px-4 py-3 shadow-lg flex flex-col sm:flex-row items-center justify-center gap-3">
          <span className="text-sm">
            {updateBlockiert
              ? "Bitte zuerst die offene Bestellung abschließen oder verwerfen."
              : "Eine neue Version ist verfügbar."}
          </span>
          <button
            onClick={updateKlick}
            className="rounded-lg bg-white/15 hover:bg-white/25 px-4 py-2 text-sm font-medium min-h-touch"
          >
            Jetzt aktualisieren
          </button>
        </div>
      )}
    </>
  );
}
