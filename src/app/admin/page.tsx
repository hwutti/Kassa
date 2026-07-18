import Link from "next/link";

const KARTEN = [
  { href: "/admin/produkte", titel: "Produkte", text: "Produkte anlegen, Preise pflegen, Kategorien & Verkaufsbereiche zuordnen." },
  { href: "/admin/kategorien", titel: "Kategorien", text: "Kategorien verwalten und aktiv/inaktiv schalten." },
  { href: "/admin/verkaufsbereiche", titel: "Verkaufsbereiche", text: "Verkaufsbereiche verwalten und aktiv/inaktiv schalten." },
  { href: "/admin/bestellungen", titel: "Bestellungen", text: "Abgeschlossene Bestellungen einsehen." },
];

export default function AdminHome() {
  return (
    <div className="space-y-4">
      <p className="text-neutral-400">
        Zentrale Verwaltung. Nur Produkte mit gültigem Preis und in aktiven Kategorien/Bereichen
        erscheinen in der Kasse.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {KARTEN.map((k) => (
          <Link key={k.href} href={k.href} className="card p-4 hover:border-brand-600 transition">
            <div className="font-semibold text-lg">{k.titel}</div>
            <div className="text-sm text-neutral-400 mt-1">{k.text}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
