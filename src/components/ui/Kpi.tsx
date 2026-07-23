/** Einheitliche Kennzahl-Kachel (KPI) für alle Übersichten. */
export function Kpi({
  label,
  wert,
  ton = "neutral",
}: {
  label: string;
  wert: string | number;
  ton?: "neutral" | "gut" | "warnung";
}) {
  // Farbe nur zeigen, wenn es etwas hervorzuheben gibt (Zahl > 0 bzw. beliebiger Text).
  const aktiv = typeof wert === "number" ? wert > 0 : true;
  const farbe = ton === "gut" && aktiv ? "text-brand-50" : ton === "warnung" && aktiv ? "text-amber-300" : "";
  return (
    <div className="card p-3 text-center">
      <div className={`text-2xl font-bold tabular-nums ${farbe}`}>{wert}</div>
      <div className="text-xs text-neutral-400">{label}</div>
    </div>
  );
}
