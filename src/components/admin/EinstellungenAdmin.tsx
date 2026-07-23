"use client";

import { useEffect, useState } from "react";
import { jsonFetch } from "@/lib/client";

type Konfig = {
  titel: string;
  untertitel: string | null;
  logoUrl: string | null;
  logoHoehe: number;
  design: string;
  sumupAffiliateKey: string | null;
  bonAutoDruck: boolean;
  rawbtAktiv: boolean;
  bedienungsmodus: string;
};

const MODI: { id: string; name: string; ablauf: string }[] = [
  {
    id: "SZENARIO_1",
    name: "Szenario 1 – ein Kellner macht alles",
    ablauf: "Kellner nimmt auf → Bereiche machen fertig → derselbe Kellner holt ab, liefert aus und kassiert am Ende.",
  },
  {
    id: "SZENARIO_2",
    name: "Szenario 2 – aufnehmen & kassieren, Läufer liefert",
    ablauf: "Kellner nimmt auf und kassiert sofort → Bereiche machen fertig → ein extra Kellner (Läufer) bringt es nur noch zum Tisch.",
  },
];

const DESIGNS: { id: string; name: string; vorschau: string }[] = [
  { id: "dunkel", name: "Standard", vorschau: "#0a0a0a" },
  { id: "glas", name: "Glas", vorschau: "linear-gradient(135deg, rgba(56,189,248,.5), rgba(168,85,247,.5)), #0b1220" },
  { id: "aurora", name: "Aurora", vorschau: "radial-gradient(circle at 20% 20%, rgba(16,185,129,.8), transparent 60%), radial-gradient(circle at 80% 30%, rgba(59,130,246,.7), transparent 60%), #060913" },
  { id: "modern", name: "Modern", vorschau: "linear-gradient(160deg, #1f2a44, #0a0a0a)" },
  { id: "cool", name: "Cool", vorschau: "radial-gradient(circle at 90% 10%, rgba(34,211,238,.7), transparent 55%), #08111f" },
  { id: "mitternacht", name: "Mitternacht", vorschau: "radial-gradient(circle at 50% 0%, #1b2a6b, #05060a 65%)" },
];

export function EinstellungenAdmin() {
  const [titel, setTitel] = useState("");
  const [untertitel, setUntertitel] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoHoehe, setLogoHoehe] = useState(48);
  const [design, setDesign] = useState("dunkel");
  const [sumupKey, setSumupKey] = useState("");
  const [bonAutoDruck, setBonAutoDruck] = useState(false);
  const [rawbtAktiv, setRawbtAktiv] = useState(false);
  const [bedienungsmodus, setBedienungsmodus] = useState("SZENARIO_1");
  const [fehler, setFehler] = useState<string | null>(null);
  const [gespeichert, setGespeichert] = useState(false);
  const [ladeBild, setLadeBild] = useState(false);

  useEffect(() => {
    jsonFetch<Konfig>("/api/admin/konfiguration")
      .then((k) => {
        setTitel(k.titel);
        setUntertitel(k.untertitel ?? "");
        setLogoUrl(k.logoUrl);
        setLogoHoehe(k.logoHoehe ?? 48);
        setDesign(k.design ?? "dunkel");
        setSumupKey(k.sumupAffiliateKey ?? "");
        setBonAutoDruck(Boolean(k.bonAutoDruck));
        setRawbtAktiv(Boolean(k.rawbtAktiv));
        setBedienungsmodus(k.bedienungsmodus === "SZENARIO_2" ? "SZENARIO_2" : "SZENARIO_1");
      })
      .catch((e) => setFehler((e as Error).message));
  }, []);

  // Design live anwenden (Vorschau für den ganzen Adminbereich).
  function designWaehlen(d: string) {
    setDesign(d);
    document.documentElement.dataset.design = d;
  }

  async function bildHochladen(datei: File) {
    setLadeBild(true);
    setFehler(null);
    try {
      const fd = new FormData();
      fd.append("datei", datei);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const info = await res.json();
      if (!res.ok) throw new Error(info.error ?? "Upload fehlgeschlagen.");
      setLogoUrl(info.url);
    } catch (e) {
      setFehler((e as Error).message);
    } finally {
      setLadeBild(false);
    }
  }

  async function speichern() {
    setFehler(null);
    try {
      await jsonFetch("/api/admin/konfiguration", {
        method: "PATCH",
        body: JSON.stringify({
          titel: titel.trim() || "Kasse",
          untertitel: untertitel.trim() || null,
          logoUrl,
          logoHoehe,
          design,
          sumupAffiliateKey: sumupKey.trim() || null,
          bonAutoDruck,
          rawbtAktiv,
          bedienungsmodus,
        }),
      });
      try {
        window.localStorage.setItem("pos-kasse:design", design);
      } catch {
        /* ignorieren */
      }
      setGespeichert(true);
      setTimeout(() => setGespeichert(false), 2500);
    } catch (e) {
      setFehler((e as Error).message);
    }
  }

  return (
    <div className="space-y-4 max-w-lg">
      <p className="text-sm text-neutral-400">
        Logo und Titel erscheinen im Kopf der Kassenansicht. Ein transparentes PNG wirkt am besten.
      </p>

      {/* Live-Vorschau des Headers */}
      <div className="card p-3 flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl || "/logo.svg"}
          alt="Logo"
          style={{ height: logoHoehe }}
          className="w-auto max-w-[280px] object-contain"
        />
        <div>
          <div className="font-semibold">{titel || "Kasse"}</div>
          {untertitel && <div className="text-xs text-neutral-400">{untertitel}</div>}
        </div>
      </div>

      {/* Logogröße */}
      <label className="block">
        <span className="text-sm text-neutral-400">Logo-Größe: {logoHoehe} px</span>
        <input
          type="range"
          min={16}
          max={160}
          step={2}
          value={logoHoehe}
          onChange={(e) => setLogoHoehe(Number(e.target.value))}
          className="w-full mt-1 accent-brand-600"
        />
        <div className="flex justify-between text-[11px] text-neutral-500">
          <span>klein</span>
          <span>groß</span>
        </div>
      </label>

      <div>
        <span className="text-sm text-neutral-400">
          Logo (PNG/JPG/WebP/SVG, transparent empfohlen, max. 8 MB)
        </span>
        <div className="mt-1 flex items-center gap-3">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="text-sm text-neutral-300 file:mr-2 file:rounded-lg file:border-0 file:bg-neutral-700 file:px-3 file:py-1.5 file:text-neutral-100"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) bildHochladen(f);
            }}
          />
          {logoUrl && (
            <button className="text-xs text-red-300" onClick={() => setLogoUrl(null)}>
              Logo entfernen
            </button>
          )}
        </div>
        {ladeBild && <p className="text-xs text-neutral-400 mt-1">Lädt Logo hoch …</p>}
      </div>

      {/* Hintergrund-Design */}
      <div>
        <span className="text-sm text-neutral-400">Hintergrund-Design</span>
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {DESIGNS.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => designWaehlen(d.id)}
              className={`rounded-xl border p-2 text-left transition ${
                design === d.id
                  ? "border-brand-600 ring-2 ring-brand-600"
                  : "border-neutral-700 hover:border-neutral-500"
              }`}
            >
              <span
                className="block h-12 w-full rounded-lg border border-white/10"
                style={{ background: d.vorschau }}
              />
              <span className="mt-1 block text-sm">{d.name}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-neutral-500 mt-1">
          Vorschau wird sofort angewendet. Erst mit „Speichern" dauerhaft übernommen.
        </p>
      </div>

      <label className="block">
        <span className="text-sm text-neutral-400">Titel</span>
        <input className="input mt-1" value={titel} onChange={(e) => setTitel(e.target.value)} />
      </label>
      <label className="block">
        <span className="text-sm text-neutral-400">Untertitel (optional)</span>
        <input
          className="input mt-1"
          value={untertitel}
          onChange={(e) => setUntertitel(e.target.value)}
        />
      </label>

      {/* Betriebsart / Ablauf fürs Fest */}
      <div className="border-t border-neutral-800 pt-4 space-y-2">
        <h3 className="font-semibold">Ablauf fürs Fest</h3>
        <p className="text-sm text-neutral-400">
          So arbeiten alle Kellner bei diesem Fest. Der <strong>Tresen-/Direktverkauf</strong> (Kunde bestellt &amp;
          zahlt direkt am Stand) ist <strong>immer zusätzlich möglich</strong> – unabhängig vom gewählten Szenario.
        </p>
        <div className="grid gap-2">
          {MODI.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setBedienungsmodus(m.id)}
              className={`rounded-xl border p-3 text-left transition ${
                bedienungsmodus === m.id
                  ? "border-brand-600 ring-2 ring-brand-600"
                  : "border-neutral-700 hover:border-neutral-500"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`h-4 w-4 shrink-0 rounded-full border ${
                    bedienungsmodus === m.id ? "border-brand-600 bg-brand-600" : "border-neutral-500"
                  }`}
                />
                <span className="font-medium">{m.name}</span>
              </div>
              <p className="mt-1 text-xs text-neutral-400">{m.ablauf}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Kartenzahlung + Bondruck */}
      <div className="border-t border-neutral-800 pt-4 space-y-3">
        <h3 className="font-semibold">Kasse &amp; Zahlung</h3>
        <label className="block">
          <span className="text-sm text-neutral-400">SumUp Affiliate-Key (für Kartenzahlung, optional)</span>
          <input
            className="input mt-1"
            value={sumupKey}
            onChange={(e) => setSumupKey(e.target.value)}
            placeholder="aus dem SumUp-Entwicklerportal"
            autoComplete="off"
          />
          <span className="text-[11px] text-neutral-500">
            Leer lassen, wenn keine Kartenzahlung genutzt wird. Der Absprung öffnet die SumUp-App auf dem Gerät.
          </span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="accent-brand-600 h-4 w-4"
            checked={bonAutoDruck}
            onChange={(e) => setBonAutoDruck(e.target.checked)}
          />
          <span className="text-sm">Bon nach der Zahlung automatisch drucken (Systemdrucker)</span>
        </label>
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            className="accent-brand-600 h-4 w-4 mt-0.5"
            checked={rawbtAktiv}
            onChange={(e) => setRawbtAktiv(e.target.checked)}
          />
          <span className="text-sm">
            RawBT-Direktdruck (Android)
            <span className="block text-[11px] text-neutral-500">
              Sendet den Beleg ohne Druckdialog an einen per RawBT eingerichteten Bluetooth-Thermodrucker. Zusätzlicher Knopf
              „Direkt drucken" in der Beleg-Vorschau. Voraussetzung: RawBT-App am Tablet installiert und mit dem Drucker gekoppelt.
            </span>
          </span>
        </label>
      </div>

      {fehler && <p className="text-red-300 text-sm">{fehler}</p>}

      <div className="flex items-center gap-3">
        <button className="btn-primary" onClick={speichern}>
          Speichern
        </button>
        {gespeichert && <span className="text-sm text-brand-50">✓ Gespeichert</span>}
      </div>
    </div>
  );
}
