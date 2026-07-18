import Link from "next/link";
import type { ReactNode } from "react";

const NAV = [
  { href: "/admin", label: "Übersicht" },
  { href: "/admin/produkte", label: "Produkte" },
  { href: "/admin/kategorien", label: "Kategorien" },
  { href: "/admin/verkaufsbereiche", label: "Verkaufsbereiche" },
  { href: "/admin/bestellungen", label: "Bestellungen" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col">
      <header className="border-b border-neutral-800 bg-neutral-900/80 backdrop-blur">
        <div className="px-3 py-2 flex items-center gap-3">
          <h1 className="text-lg font-semibold">Verwaltung</h1>
          <Link href="/kasse" className="btn-ghost py-1.5 text-sm ml-auto">
            → Zur Kasse
          </Link>
        </div>
        <nav className="px-2 pb-2 flex gap-1 overflow-x-auto">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="shrink-0 rounded-lg px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="flex-1 p-3 sm:p-5 max-w-5xl w-full mx-auto">{children}</main>
    </div>
  );
}
