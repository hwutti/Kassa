"use client";

import { useCallback, useEffect, useState } from "react";
import { jsonFetch } from "@/lib/client";
import { formatCent } from "@/lib/money";
import { RollenHeader } from "@/components/rolle/RollenHeader";
import { InstallButton } from "@/components/kasse/InstallButton";
import { ZahlModal } from "@/components/rolle/ZahlModal";
import { BelegUebersicht, type Beleg } from "@/components/rolle/BelegUebersicht";
import { StatusKopf, ZahlungBadge, BereichChip } from "@/components/rolle/StatusUi";
import { Kpi } from "@/components/ui/Kpi";
import { useLive } from "@/lib/useLive";
import { minutenSeit } from "@/lib/zeit";
import { druckeBon } from "@/lib/bon";

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
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [untertitel, setUntertitel] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  const [zahlFuer, setZahlFuer] = useState<OffeneBestellung | null>(null);
  const [sumupKey, setSumupKey] = useState<string | null>(null);
  const [bonAutoDruck, setBonAutoDruck] = useState(false);
  // Einheitlicher Abschluss (wie am Tresen): „Bezahlen" -> Rechnung prüfen -> buchen.
  const [beleg, setBeleg] = useState<Beleg | null>(null);
  const [kontext, setKontext] = useState<{ bestellungId: string; nummer: number; tisch: string | null; verkaeufer: string | null } | null>(null);
  const [abschlussLaedt, setAbschlussLaedt] = useState(false);
  const [abschlussFehler, setAbschlussFehler] = useState<string | null>(null);

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
    jsonFetch<{ titel?: string; logoUrl?: string | null; untertitel?: string | null; aktiveVeranstaltung?: { name: string } | null }>(
      "/api/konfiguration",
    )
      .then((k) => {
        if (k.titel) setTitel(k.titel);
        setLogoUrl(k.logoUrl ?? null);
        setUntertitel(k.aktiveVeranstaltung?.name ?? k.untertitel ?? null);
      })
      .catch(() => undefined);
    jsonFetch<{ sumupAffiliateKey: string | null; bonAutoDruck: boolean }>("/api/kasse/konfig")
      .then((k) => {
        setSumupKey(k.sumupAffiliateKey);
        setBonAutoDruck(k.bonAutoDruck);
      })
      .catch(() => undefined);
  }, []);

  // Schritt 1: „Bezahlen" bucht NICHT, sondern zeigt die komplette Rechnung zur Kontrolle.
  function bezahlen(gegebenCent: number | null, art: string) {
    if (!zahlFuer) return;
    const s = zahlFuer.summeCent;
    const rueckgeldCent = art === "BAR" && gegebenCent != null && gegebenCent >= s ? gegebenCent - s : null;
    setBeleg({
      positionen: zahlFuer.positionen.map((p) => ({ produktName: p.produktName, menge: p.menge, einzelpreisCent: p.einzelpreisCent, summeCent: p.summeCent })),
      summeCent: s,
      art,
      gegebenCent: art === "BAR" ? gegebenCent : null,
      rueckgeldCent,
    });
    setKontext({ bestellungId: zahlFuer.id, nummer: zahlFuer.nummer, tisch: zahlFuer.tisch ?? zahlFuer.abholnummer, verkaeufer: zahlFuer.verkaeufer });
    setAbschlussFehler(null);
    setZahlFuer(null);
  }

  // „Korrigieren": zurück, es wird nichts gebucht (die Bestellung bleibt offen).
  function belegKorrigieren() {
    setBeleg(null);
    setKontext(null);
    setAbschlussFehler(null);
  }

  // Schritt 2: Zahlung jetzt buchen, optional (oder laut Einstellung automatisch) drucken.
  async function belegAbschliessen(drucken: boolean) {
    if (!beleg || !kontext || abschlussLaedt) return;
    setAbschlussLaedt(true);
    setAbschlussFehler(null);
    try {
      const res = await jsonFetch<{ rueckgeldCent: number | null }>(`/api/bestellungen/${kontext.bestellungId}/zahlung`, {
        method: "POST",
        body: JSON.stringify({ gegebenCent: beleg.gegebenCent, art: beleg.art }),
      });
      if (drucken || bonAutoDruck) {
        druckeBon({
          titel,
          untertitel,
          logoUrl,
          nummer: kontext.nummer,
          datum: new Date().toLocaleString("de-AT"),
          verkaeufer: kontext.verkaeufer,
          tisch: kontext.tisch,
          positionen: beleg.positionen,
          summeCent: beleg.summeCent,
          art: beleg.art,
          gegebenCent: beleg.gegebenCent,
          rueckgeldCent: res?.rueckgeldCent ?? beleg.rueckgeldCent,
        });
      }
      setBeleg(null);
      setKontext(null);
      laden();
    } catch (e) {
      setAbschlussFehler((e as Error).message);
    } finally {
      setAbschlussLaedt(false);
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
          <Kpi label="Offen" wert={bestellungen.length} ton="gut" />
          <Kpi label="Summe offen" wert={formatCent(summeOffen)} />
          <Kpi label="Heute kassiert" wert={heuteKassiert} />
        </div>

        {bestellungen.length === 0 && (
          <p className="text-neutral-400 text-center py-10">Keine offenen Zahlungen. 🎉</p>
        )}

        {bestellungen.map((b) => (
          <div key={b.id} className="card p-0 overflow-hidden">
            <StatusKopf status={b.bestellStatus} minuten={minutenSeit(b.createdAt)} />
            <div className="p-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-semibold text-base">
                  Nr. {b.nummer}
                  {b.tisch ? ` · Tisch ${b.tisch}` : b.abholnummer ? ` · Nr. ${b.abholnummer}` : ""}
                  {b.gast ? ` · ${b.gast}` : ""}
                </span>
                <ZahlungBadge bezahlt={b.zahlungStatus === "PAID"} />
              </div>

              <div className="mt-1 text-xs text-neutral-400">Verkäufer: {b.verkaeufer}</div>

              {b.bereiche.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {b.bereiche.map((a, i) => (
                    <BereichChip key={i} name={a.name} status={a.status} />
                  ))}
                </div>
              )}

              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className="text-lg font-bold text-neutral-50 tabular-nums">{formatCent(b.summeCent)}</span>
                <button className="btn-primary py-1.5 text-sm ml-auto" onClick={() => setZahlFuer(b)}>
                  Kassieren
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {zahlFuer && (
        <ZahlModal
          nummer={zahlFuer.nummer}
          summeCent={zahlFuer.summeCent}
          positionen={zahlFuer.positionen}
          laedt={false}
          fehler={null}
          sumupAffiliateKey={sumupKey}
          onAbbrechen={() => setZahlFuer(null)}
          onBezahlen={bezahlen}
        />
      )}

      {beleg && (
        <BelegUebersicht
          beleg={beleg}
          laedt={abschlussLaedt}
          fehler={abschlussFehler}
          onKorrigieren={belegKorrigieren}
          onFertig={() => belegAbschliessen(false)}
          onDrucken={() => belegAbschliessen(true)}
        />
      )}
    </div>
  );
}
