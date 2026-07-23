"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { jsonFetch } from "@/lib/client";
import { Kpi } from "@/components/ui/Kpi";

type Status = {
  aktiveProdukte: number;
  verkaufbareProdukte: number;
  aktiveOhnePreis: number;
  deaktivierte: number;
  mitInaktiverKategorie: number;
  ohneVerkaufsbereich: number;
  aktiveBereiche: number;
  aktiveKategorien: number;
  kasseBereit: boolean;
};

export function KassenbereitschaftDashboard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    jsonFetch<Status>("/api/admin/status")
      .then(setStatus)
      .catch((e) => setFehler((e as Error).message));
  }, []);

  return (
    <div className="space-y-5">
      {/* Kassenbereitschaft */}
      <div
        className={`card p-4 flex items-center gap-4 ${
          status?.kasseBereit ? "border-brand-600" : "border-amber-500/50"
        }`}
      >
        <div className="text-4xl">{status?.kasseBereit ? "✅" : "⚠️"}</div>
        <div>
          <div className="text-lg font-semibold">
            {status ? (status.kasseBereit ? "Kasse ist betriebsbereit" : "Kasse noch nicht bereit") : "Prüfe …"}
          </div>
          <div className="text-sm text-neutral-400">
            {status
              ? `${status.verkaufbareProdukte} verkaufbare Produkte in ${status.aktiveBereiche} aktiven Bereichen`
              : ""}
          </div>
        </div>
      </div>

      {fehler && <p className="text-red-300 text-sm">{fehler}</p>}

      {/* Kennzahlen */}
      {status && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Kpi label="Aktive Produkte" wert={status.aktiveProdukte} />
          <Kpi label="Verkaufbar" wert={status.verkaufbareProdukte} ton="gut" />
          <Kpi
            label="Aktiv ohne Preis"
            wert={status.aktiveOhnePreis}
            ton="warnung"
            hinweis={status.aktiveOhnePreis >= 1 ? "Preis fehlt" : undefined}
          />
          <Kpi label="Deaktiviert/archiviert" wert={status.deaktivierte} />
          <Kpi label="Inaktive Kategorie" wert={status.mitInaktiverKategorie} ton="warnung" />
          <Kpi label="Ohne Verkaufsbereich" wert={status.ohneVerkaufsbereich} ton="warnung" />
        </div>
      )}

      {status && status.aktiveOhnePreis > 0 && (
        <Link href="/admin/produkte" className="btn-ghost inline-flex">
          → {status.aktiveOhnePreis} Produkte ohne Preis pflegen
        </Link>
      )}

      {/* Verwaltungsbereiche */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Karte href="/admin/produkte" titel="Produkte & Preise" text="Produkte anlegen, Preise pflegen, zuordnen." />
        <Karte href="/admin/preise" titel="Preisübersicht" text="Alle Preise auf einen Blick, fehlende Preise erkennen." />
        <Karte href="/admin/kategorien" titel="Kategorien" text="Kategorien verwalten und sortieren." />
        <Karte href="/admin/verkaufsbereiche" titel="Verkaufsbereiche" text="Verkaufsbereiche verwalten." />
        <Karte href="/admin/bestellungen" titel="Bestellungen" text="Bestellungen einsehen und stornieren." />
        <Karte href="/admin/auswertungen" titel="Auswertungen" text="Umsätze und Verkaufszahlen." />
      </div>
    </div>
  );
}

function Karte({ href, titel, text }: { href: string; titel: string; text: string }) {
  return (
    <Link href={href} className="card p-4 hover:border-brand-600 transition">
      <div className="font-semibold">{titel}</div>
      <div className="text-sm text-neutral-400 mt-1">{text}</div>
    </Link>
  );
}
