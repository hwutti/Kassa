"use client";

import { useSyncExternalStore } from "react";

// Zentraler, framework-leichter Zustand für Verbindungs- und Update-Status.
// Wird sowohl vom PwaController (Layout) als auch von der Kasse genutzt.

type PwaState = {
  /** true = Server/DB erreichbar. Kombiniert navigator.onLine + Health-Ping. */
  online: boolean;
  /** true = eine neue App-Version wartet auf Aktivierung. */
  updateReady: boolean;
};

// Initial optimistisch online; der erste Health-Check korrigiert das bei Bedarf.
let state: PwaState = { online: true, updateReady: false };

let wartenderWorker: ServiceWorker | null = null;
// Signalisiert, ob gerade eine Bestellung bearbeitet wird. Ein Update darf sie nicht zerstören.
let bestellungOffen = false;
const listeners = new Set<() => void>();

export function setBestellungOffen(offen: boolean) {
  bestellungOffen = offen;
}

export function istBestellungOffen() {
  return bestellungOffen;
}

function emit() {
  for (const l of listeners) l();
}

function setState(patch: Partial<PwaState>) {
  const next = { ...state, ...patch };
  if (next.online === state.online && next.updateReady === state.updateReady) return;
  state = next;
  emit();
}

export function setOnline(online: boolean) {
  setState({ online });
}

export function setUpdateWorker(worker: ServiceWorker | null) {
  wartenderWorker = worker;
  setState({ updateReady: worker !== null });
}

/**
 * Aktiviert die wartende neue Version bewusst (nach Abschluss/Verwerfen einer Bestellung).
 * Der SW ruft skipWaiting, danach lädt die Seite neu (controllerchange).
 */
export function updateAnwenden() {
  const worker = wartenderWorker;
  if (!worker) return;
  let neuGeladen = false;
  navigator.serviceWorker?.addEventListener("controllerchange", () => {
    if (neuGeladen) return;
    neuGeladen = true;
    window.location.reload();
  });
  worker.postMessage({ type: "SKIP_WAITING" });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): PwaState {
  return state;
}

const serverSnapshot: PwaState = { online: true, updateReady: false };
function getServerSnapshot(): PwaState {
  return serverSnapshot;
}

export function usePwaStatus(): PwaState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
