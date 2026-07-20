"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

const NAV = [
  { href: "/admin", label: "Übersicht" },
  { href: "/admin/produkte", label: "Produkte" },
  { href: "/admin/preise", label: "Preise" },
  { href: "/admin/kategorien", label: "Kategorien" },
  { href: "/admin/verkaufsbereiche", label: "Verkaufsbereiche" },
  { href: "/admin/arbeitsbereiche", label: "Arbeitsbereiche" },
  { href: "/admin/veranstaltungen", label: "Veranstaltungen" },
  { href: "/admin/bestellungen", label: "Bestellungen" },
  { href: "/admin/auswertungen", label: "Auswertungen" },
  { href: "/admin/benutzer", label: "Benutzer" },
  { href: "/admin/einstellungen", label: "Einstellungen" },
];

export function AdminChrome({ benutzer, children }: { benutzer: string; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  async function abmelden() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <header className="border-b border-neutral-800 bg-neutral-900/80 backdrop-blur">
        <div className="px-3 py-2 flex items-center gap-3">
          <h1 className="text-lg font-semibold">Verwaltung</h1>
          <span className="text-xs text-neutral-400 hidden sm:inline">angemeldet als {benutzer}</span>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/kasse" className="btn-ghost py-1.5 text-sm">
              → Zur Kasse
            </Link>
            <button onClick={abmelden} className="btn-ghost py-1.5 text-sm">
              Abmelden
            </button>
          </div>
        </div>
        <nav className="px-2 pb-2 flex gap-1 overflow-x-auto">
          {NAV.map((n) => {
            const aktiv = pathname === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`shrink-0 rounded-lg px-3 py-2 text-sm ${
                  aktiv ? "bg-neutral-800 text-white" : "text-neutral-300 hover:bg-neutral-800"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="flex-1 p-3 sm:p-5 max-w-5xl w-full mx-auto">{children}</main>
    </div>
  );
}
