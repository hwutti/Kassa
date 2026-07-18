"use client";

import { useEffect } from "react";

const KEY = "pos-kasse:design";
const ERLAUBT = ["dunkel", "glas", "aurora", "modern", "cool", "mitternacht"];

/** Setzt das gewählte Hintergrund-Design app-weit auf <html data-design="…">. */
export function ThemeApplier() {
  useEffect(() => {
    const setzen = (d: string) => {
      if (ERLAUBT.includes(d)) document.documentElement.dataset.design = d;
    };
    // Sofort aus dem Cache anwenden (kein Flackern), dann frisch vom Server holen.
    try {
      const cached = window.localStorage.getItem(KEY);
      if (cached) setzen(cached);
    } catch {
      /* ignorieren */
    }
    fetch("/api/konfiguration", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((k) => {
        if (k?.design) {
          setzen(k.design);
          try {
            window.localStorage.setItem(KEY, k.design);
          } catch {
            /* ignorieren */
          }
        }
      })
      .catch(() => undefined);
  }, []);

  return null;
}
