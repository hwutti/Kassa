"use client";

import { useEffect, useState } from "react";
import { usePwaStatus, installAusloesen } from "@/lib/pwa-store";
import { useDialog } from "@/components/ui/DialogProvider";

/**
 * „Installieren"-Button im Kassen-Header.
 * - Ist ein natives Installations-Event vorhanden (Chrome/Edge/Android): direkter Dialog.
 * - Sonst (z. B. iPhone/iPad): platform-passende Anleitung zum manuellen Installieren.
 * - Ausgeblendet, wenn die App bereits als installierte PWA läuft.
 */
export function InstallButton() {
  const { installierbar } = usePwaStatus();
  const dialog = useDialog();
  const [alsAppGestartet, setAlsAppGestartet] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // iOS Safari
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setAlsAppGestartet(Boolean(standalone));
  }, []);

  if (alsAppGestartet) return null; // schon installiert → kein Button nötig

  async function klick() {
    if (installierbar) {
      const ergebnis = await installAusloesen();
      if (ergebnis === "unavailable") await anleitungZeigen();
      return;
    }
    await anleitungZeigen();
  }

  async function anleitungZeigen() {
    const ua = navigator.userAgent;
    const istIOS =
      /iphone|ipad|ipod/i.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const istAndroid = /android/i.test(ua);

    let text: string;
    if (istIOS) {
      text = [
        "So installierst du die Kasse auf iPhone/iPad:",
        "",
        "1. Diese Seite in Safari öffnen.",
        "2. Auf das Teilen-Symbol tippen (Quadrat mit Pfeil nach oben).",
        "3. »Zum Home-Bildschirm« wählen.",
        "4. Mit »Hinzufügen« bestätigen.",
      ].join("\n");
    } else if (istAndroid) {
      text = [
        "So installierst du die Kasse auf Android:",
        "",
        "1. Browser-Menü (⋮) öffnen.",
        "2. »App installieren« bzw. »Zum Startbildschirm hinzufügen« tippen.",
        "3. Bestätigen.",
      ].join("\n");
    } else {
      text = [
        "So installierst du die Kasse:",
        "",
        "1. Auf das Installations-Symbol rechts in der Adressleiste klicken",
        "   (Monitor mit Pfeil) – oder Menü ⋮ → »App installieren«.",
        "2. Bestätigen.",
        "",
        "Hinweis: Die Installation ist nur über HTTPS möglich.",
      ].join("\n");
    }
    await dialog.alert({ titel: "App installieren", text });
  }

  return (
    <button onClick={klick} className="btn-ghost py-1.5 text-sm" title="Kasse als App installieren">
      {/* Sauberes Download-/Install-Icon (nutzt die Textfarbe des Buttons). */}
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="shrink-0"
      >
        <path d="M12 3v11" />
        <path d="m7 10 5 5 5-5" />
        <path d="M5 20h14" />
      </svg>
      <span className="hidden sm:inline">Installieren</span>
    </button>
  );
}
