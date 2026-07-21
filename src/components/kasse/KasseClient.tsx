"use client";

import { useCallback, useEffect, useState } from "react";
import { jsonFetch } from "@/lib/client";
import { formatCent } from "@/lib/money";
import { RollenHeader } from "@/components/rolle/RollenHeader";
import { InstallButton } from "@/components/kasse/InstallButton";
import { ZahlModal } from "@/components/rolle/ZahlModal";
import { BESTELL_STATUS_LABEL } from "@/lib/statuslogik";
import { useLive } from "@/lib/useLive";
import { druckeBon, type BonDaten } from "@/lib/bon";

type Position = { produktName: string; menge: number; einzelpreisCent: number; summeCent: number; status: string };
type OffeneBestellung = {
  id: string;
  nummer: number;
  tisch: string | null;
  gast: string | null;
  abholnummer: string | null;
  verkaeufer: string;
  summeCent: number;
  bestellStatus: string;
  zahlungStatus: string;
  auslieferungStatus: string;
  createdAt: string;
  positionen: Position[];
  bereiche: { name: string; status: string }[];
};

/**
 * Zentrale Kassa: zeigt live alle offenen, noch nicht bezahlten Bestellungen
 * aller Verkäufer und kassiert sie mit Geldrechner/Rückgeld ab.
 */
export function KasseClient() {
  const [bestellungen, setBestellungen] = useState<OffeneBestellung[]>([]);
  const [heuteKassiert, setHeuteKassiert] = useState(0);
  const [titel, setTitel] = useState("Kassa");
  const [fehler, setFehler] = useState<string | null>(null);

  const [zahlFuer, setZahlFuer] = useState<OffeneBestellung | null>(null);
  const [zahlLaedt, setZahlLaedt] = useState(false);
  const [zahlFehler, setZahlFehler] = useState<string | null>(null);
  const [bonDaten, setBonDaten] = useState<BonDaten | null>(null);
  const [sumupKey, setSumupKey] = useState<string | null>(null);
  const [bonAutoDruck, setBonAutoDruck] = useState(false);

  const laden = useCallback(async () => {
    try {
      const d = await jsonFetch<{ bestellungen: OffeneBestellung[]; heuteKassiert: number }>("/api/kasse/offen");
      setBestellungen(d.bestellungen);
      setHeuteKassiert(d.heuteKassiert);
      setFehler(null);
    } catch (e) {
      setFehler((e as Error).message);
    }
  }, []);

  useEffect(() => {
    laden();
  }, [laden]);
  useLive(laden);

  useEffect(() => {
    jsonFetch<{ titel?: string }>("/api/konfiguration")
      .then((k) => k.titel && setTitel(k.titel))
      .catch(() => undefined);
    jsonFetch<{ sumupAffiliateKey: string | null; bonAutoDruck: boolean }>("/api/kasse/konfig")
      .then((k) => {
        setSumupKey(k.sumupAffiliateKey);
        setBonAutoDruck(k.bonAutoDruck);
      })
      .catch(() => undefined);
  }, []);

  async function bezahlen(gegebenCent: number | null, art: string) {
    if (!zahlFuer || zahlLaedt) return;
    setZahlLaedt(true);
    setZahlFehler(null);
    try {
      const res = await jsonFetch<{ rueckgeldCent: number | null }>(`/api/bestellungen/${zahlFuer.id}/zahlung`, {
        method: "POST",
        body: JSON.stringify({ gegebenCent, art }),
      });
      // Beleg-Daten für den optionalen Bondruck merken.
      const bon: BonDaten = {
        titel,
        nummer: zahlFuer.nummer,
        datum: new Date().toLocaleString("de-AT"),
        positionen: zahlFuer.positionen,
        summeCent: zahlFuer.summeCent,
        art,
        gegebenCent,
        rueckgeldCent: res?.rueckgeldCent ?? null,
      };
      setBonDaten(bon);
      if (bonAutoDruck) druckeBon(bon); // automatischer Bondruck (Systemdrucker)
      setZahlFuer(null);
      laden();
    } catch (e) {
      setZahlFehler((e as Error).message);
    } finally {
      setZahlLaedt(false);
    }
  }

  const summeOffen = bestellungen.reduce((s, b) => s + b.summeCent, 0);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <RollenHeader titel={titel}>
        <InstallButton />
      </RollenHeader>

      {fehler && <p className="text-red-300 text-sm px-3 pt-2">{fehler}</p>}

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Kennzahlen */}
        <div className="grid grid-cols-3 gap-2">
          <Kpi label="Offen" wert={String(bestellungen.length)} akzent={bestellungen.length > 0} />
          <Kpi label="Summe offen" wert={formatCent(summeOffen)} />
          <Kpi label="Heute kassiert" wert={String(heuteKassiert)} />
        </div>

        {bestellungen.length === 0 && (
          <p className="text-neutral-400 text-center py-10">Keine offenen Zahlungen. 🎉</p>
        )}

        {bestellungen.map((b) => {
          const bereit = b.auslieferungStatus === "READY_FOR_PICKUP";
          const ausgeliefert = b.auslieferungStatus === "DELIVERED";
          return (
            <div
              key={b.id}
              className={`card p-3 border-l-4 ${bereit ? "border-brand-600" : ausgeliefert ? "border-blue-500" : "border-neutral-700"}`}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-semibold">
                  Nr. {b.nummer}
                  {b.tisch ? ` · Tisch ${b.tisch}` : b.abholnummer ? ` · Nr. ${b.abholnummer}` : ""}
                  {b.gast ? ` · ${b.gast}` : ""}
                </span>
                <span className="badge bg-neutral-700 text-neutral-300">
                  {BESTELL_STATUS_LABEL[b.bestellStatus] ?? b.bestellStatus}
                </span>
              </div>

              <div className="mt-1 text-xs text-neutral-400">Verkäufer: {b.verkaeufer}</div>

              {b.bereiche.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {b.bereiche.map((a, i) => (
                    <span
                      key={i}
                      className={`text-xs rounded px-1.5 py-0.5 border ${
                        a.status === "READY" || a.status === "COLLECTED"
                          ? "border-brand-600/50 text-brand-50"
                          : "border-blue-500/50 text-blue-200"
                      }`}
                    >
                      {a.name}
                      {a.status === "READY" || a.status === "COLLECTED" ? " ✓" : " …"}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className="text-lg font-semibold tabular-nums">{formatCent(b.summeCent)}</span>
                <button
                  className="btn-primary py-1.5 text-sm ml-auto"
                  onClick={() => {
                    setZahlFehler(null);
                    setZahlFuer(b);
                  }}
                >
                  Kassieren
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {zahlFuer && (
        <ZahlModal
          nummer={zahlFuer.nummer}
          summeCent={zahlFuer.summeCent}
          positionen={zahlFuer.positionen}
          laedt={zahlLaedt}
          fehler={zahlFehler}
          sumupAffiliateKey={sumupKey}
          onAbbrechen={() => setZahlFuer(null)}
          onBezahlen={bezahlen}
        />
      )}

      {bonDaten && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="card w-full max-w-xs p-5 space-y-4 text-center">
            <div className="mx-auto h-12 w-12 rounded-full flex items-center justify-center text-2xl bg-brand-600/20 text-brand-50">
              ✓
            </div>
            <div>
              <h2 className="text-lg font-semibold">Zahlung erfasst</h2>
              <p className="text-sm text-neutral-400">
                Nr. {bonDaten.nummer} · {formatCent(bonDaten.summeCent)}
                {bonDaten.rueckgeldCent !== null ? ` · Rückgeld ${formatCent(bonDaten.rueckgeldCent)}` : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <button className="btn-ghost flex-1" onClick={() => setBonDaten(null)}>
                Fertig
              </button>
              <button className="btn-primary flex-1" onClick={() => druckeBon(bonDaten)}>
                Bon drucken
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, wert, akzent }: { label: string; wert: string; akzent?: boolean }) {
  return (
    <div className="card p-2 text-center">
      <div className={`text-xl font-bold tabular-nums ${akzent ? "text-brand-50" : ""}`}>{wert}</div>
      <div className="text-xs text-neutral-400">{label}</div>
    </div>
  );
}
