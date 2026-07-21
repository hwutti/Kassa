"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/** Gemeinsamer Kopf für Rollen-Seiten (Kellner/Bereich/Übersicht/Kassa). */
export function RollenHeader({ titel, benutzer, children }: { titel: string; benutzer?: string; children?: ReactNode }) {
  const router = useRouter();
  const [istAdmin, setIstAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setIstAdmin(d?.rolle === "ADMIN"))
      .catch(() => undefined);
  }, []);

  async function abmelden() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }
  return (
    <header className="shrink-0 border-b border-neutral-800 bg-neutral-900/80 backdrop-blur px-3 py-2 flex items-center gap-3 flex-wrap">
      <span className="text-xl">🍺</span>
      <h1 className="text-base sm:text-lg font-semibold">{titel}</h1>
      {benutzer && <span className="text-xs text-neutral-400 hidden sm:inline">{benutzer}</span>}
      <div className="ml-auto flex items-center gap-2">
        {children}
        {istAdmin && (
          <Link href="/admin" className="btn-ghost py-1.5 text-sm">
            ← Verwaltung
          </Link>
        )}
        <button onClick={abmelden} className="btn-ghost py-1.5 text-sm">
          Abmelden
        </button>
      </div>
    </header>
  );
}
