"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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
  const weiter = params.get("weiter") || "/admin";

  const [benutzername, setBenutzername] = useState("");
  const [passwort, setPasswort] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);

  async function anmelden(e: React.FormEvent) {
    e.preventDefault();
    setLaedt(true);
    setFehler(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ benutzername, passwort }),
      });
      if (!res.ok) {
        const info = await res.json().catch(() => ({}));
        setFehler(info.error ?? "Anmeldung fehlgeschlagen.");
        return;
      }
      router.replace(weiter.startsWith("/admin") ? weiter : "/admin");
      router.refresh();
    } catch {
      setFehler("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setLaedt(false);
    }
  }

  return (
    <div className="flex-1 min-h-0 flex items-center justify-center p-4">
      <form onSubmit={anmelden} className="card w-full max-w-sm p-6 space-y-4">
        <div className="text-center">
          <div className="text-3xl mb-1">🧾</div>
          <h1 className="text-xl font-semibold">Administration</h1>
          <p className="text-sm text-neutral-400">Bitte anmelden</p>
        </div>

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
            inputMode="text"
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

        {fehler && (
          <p role="alert" className="text-sm text-red-300 bg-red-950/50 rounded-lg px-3 py-2">
            {fehler}
          </p>
        )}

        <button type="submit" className="btn-primary w-full" disabled={laedt}>
          {laedt ? "Anmelden …" : "Anmelden"}
        </button>

        <p className="text-center">
          <a href="/kasse" className="text-sm text-neutral-400 hover:text-neutral-200">
            ← Zur Kasse
          </a>
        </p>
      </form>
    </div>
  );
}
