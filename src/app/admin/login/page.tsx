"use client";

import { Suspense, useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { startseiteFuer } from "@/lib/rollen";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const weiter = params.get("weiter");

  const [modus, setModus] = useState<"pin" | "passwort">("pin");
  const [benutzername, setBenutzername] = useState("");
  const [passwort, setPasswort] = useState("");
  const [pin, setPin] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);

  const anmelden = useCallback(
    async (body: Record<string, string>) => {
      setLaedt(true);
      setFehler(null);
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const info = await res.json().catch(() => ({}));
        if (!res.ok) {
          setFehler(info.error ?? "Anmeldung fehlgeschlagen.");
          setPin("");
          return;
        }
        const rolle: string = info?.benutzer?.rolle ?? "ADMIN";
        const ziel = weiter && weiter.startsWith("/") ? weiter : startseiteFuer(rolle);
        router.replace(ziel);
        router.refresh();
      } catch {
        setFehler("Netzwerkfehler. Bitte erneut versuchen.");
        setPin("");
      } finally {
        setLaedt(false);
      }
    },
    [router, weiter],
  );

  function pinTaste(z: string) {
    if (laedt) return;
    setFehler(null);
    setPin((p) => {
      const neu = (p + z).slice(0, 6);
      if (neu.length === 6) void anmelden({ pin: neu });
      return neu;
    });
  }

  return (
    <div className="flex-1 min-h-0 flex items-center justify-center p-4">
      <div className="card w-full max-w-sm p-6 space-y-4">
        <div className="text-center">
          <div className="text-3xl mb-1">🧾</div>
          <h1 className="text-xl font-semibold">Anmelden</h1>
          <p className="text-sm text-neutral-400">Kellner · Bereich · Kasse · Verwaltung</p>
        </div>

        {fehler && (
          <p role="alert" className="text-sm text-red-300 bg-red-950/50 rounded-lg px-3 py-2 text-center">
            {fehler}
          </p>
        )}

        {modus === "pin" ? (
          <>
            {/* PIN-Anzeige */}
            <div className="flex justify-center gap-2 py-1" aria-label="PIN-Eingabe">
              {Array.from({ length: 6 }).map((_, i) => (
                <span
                  key={i}
                  className={`h-3.5 w-3.5 rounded-full border ${i < pin.length ? "bg-brand-600 border-brand-600" : "border-neutral-600"}`}
                />
              ))}
            </div>

            {/* Ziffernblock */}
            <div className="grid grid-cols-3 gap-2">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((z) => (
                <button key={z} className="btn-ghost h-14 text-xl font-semibold" onClick={() => pinTaste(z)} disabled={laedt}>
                  {z}
                </button>
              ))}
              <button
                className="btn-ghost h-14 text-sm"
                onClick={() => setPin((p) => p.slice(0, -1))}
                disabled={laedt || pin.length === 0}
                aria-label="Letzte Ziffer löschen"
              >
                ⌫
              </button>
              <button className="btn-ghost h-14 text-xl font-semibold" onClick={() => pinTaste("0")} disabled={laedt}>
                0
              </button>
              <button
                className="btn-primary h-14"
                onClick={() => pin.length >= 4 && anmelden({ pin })}
                disabled={laedt || pin.length < 4}
                aria-label="Anmelden"
              >
                {laedt ? "…" : "OK"}
              </button>
            </div>

            <button className="w-full text-sm text-neutral-400 hover:text-neutral-200" onClick={() => { setModus("passwort"); setFehler(null); }}>
              Mit Benutzername + Passwort anmelden
            </button>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              anmelden({ benutzername, passwort });
            }}
            className="space-y-4"
          >
            <label className="block">
              <span className="text-sm text-neutral-400">Benutzername</span>
              <input
                className="input mt-1"
                value={benutzername}
                onChange={(e) => setBenutzername(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoFocus
              />
            </label>
            <label className="block">
              <span className="text-sm text-neutral-400">Passwort</span>
              <input
                type="password"
                className="input mt-1"
                value={passwort}
                onChange={(e) => setPasswort(e.target.value)}
                autoComplete="current-password"
              />
            </label>
            <button type="submit" className="btn-primary w-full" disabled={laedt}>
              {laedt ? "Anmelden …" : "Anmelden"}
            </button>
            <button type="button" className="w-full text-sm text-neutral-400 hover:text-neutral-200" onClick={() => { setModus("pin"); setFehler(null); }}>
              Mit PIN anmelden
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
