"use client";

import { useEffect, useState } from "react";
import { jsonFetch } from "@/lib/client";

type Konfig = { titel: string; untertitel: string | null; logoUrl: string | null };

export function EinstellungenAdmin() {
  const [titel, setTitel] = useState("");
  const [untertitel, setUntertitel] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [gespeichert, setGespeichert] = useState(false);
  const [ladeBild, setLadeBild] = useState(false);

  useEffect(() => {
    jsonFetch<Konfig>("/api/admin/konfiguration")
      .then((k) => {
        setTitel(k.titel);
        setUntertitel(k.untertitel ?? "");
        setLogoUrl(k.logoUrl);
      })
      .catch((e) => setFehler((e as Error).message));
  }, []);

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
        body: JSON.stringify({ titel: titel.trim() || "Kasse", untertitel: untertitel.trim() || null, logoUrl }),
      });
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

      {/* Vorschau */}
      <div className="card p-3 flex items-center gap-3">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="Logo" className="h-12 w-12 object-contain" />
        ) : (
          <span className="text-3xl">🧾</span>
        )}
        <div>
          <div className="font-semibold">{titel || "Kasse"}</div>
          {untertitel && <div className="text-xs text-neutral-400">{untertitel}</div>}
        </div>
      </div>

      <div>
        <span className="text-sm text-neutral-400">Logo (PNG/JPG/WebP, transparent empfohlen)</span>
        <div className="mt-1 flex items-center gap-3">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
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
