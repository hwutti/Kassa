"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { jsonFetch } from "@/lib/client";

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
          <Kennzahl label="Aktive Produkte" wert={status.aktiveProdukte} />
          <Kennzahl label="Verkaufbar" wert={status.verkaufbareProdukte} gut />
          <Kennzahl
            label="Aktiv ohne Preis"
            wert={status.aktiveOhnePreis}
            warnAb={1}
            hinweis="Preis fehlt"
          />
          <Kennzahl label="Deaktiviert/archiviert" wert={status.deaktivierte} />
          <Kennzahl label="Inaktive Kategorie" wert={status.mitInaktiverKategorie} warnAb={1} />
          <Kennzahl label="Ohne Verkaufsbereich" wert={status.ohneVerkaufsbereich} warnAb={1} />
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

function Kennzahl({
  label,
  wert,
  gut,
  warnAb,
  hinweis,
}: {
  label: string;
  wert: number;
  gut?: boolean;
  warnAb?: number;
  hinweis?: string;
}) {
  const warn = warnAb !== undefined && wert >= warnAb;
  return (
    <div className="card p-3">
      <div
        className={`text-2xl font-bold tabular-nums ${
          gut ? "text-brand-50" : warn ? "text-amber-300" : ""
        }`}
      >
        {wert}
      </div>
      <div className="text-xs text-neutral-400">{label}</div>
      {warn && hinweis && <div className="text-xs text-amber-300 mt-0.5">{hinweis}</div>}
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
