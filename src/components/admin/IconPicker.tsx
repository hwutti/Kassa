"use client";

// Kuratierte Icon-Sammlung für Kategorien, Verkaufs-/Arbeitsbereiche und Produkte.
// Bewusst nur breit unterstützte Einzel-Emojis (kein exotisches ZWJ), damit sie
// auf Tablets/Bon/Systemfonts zuverlässig erscheinen. Eigenes Emoji bleibt möglich.
const ICON_GRUPPEN: { titel: string; icons: string[] }[] = [
  { titel: "Bier & Wein", icons: ["🍺", "🍻", "🍷", "🥂", "🍾", "🥃", "🍶", "🫗"] },
  { titel: "Cocktails & Spirituosen", icons: ["🍸", "🍹", "🧉", "🥤", "🧃", "🍋", "🍊", "🌿"] },
  { titel: "Heißgetränke", icons: ["☕", "🍵", "🫖", "🍫", "🥛"] },
  { titel: "Alkoholfrei", icons: ["💧", "🧊", "🥤", "🧃", "🍋", "🍏", "🫧"] },
  { titel: "Essen", icons: ["🍔", "🌭", "🍟", "🍕", "🥨", "🥪", "🌮", "🌯", "🧀", "🍗", "🍖", "🍤", "🥩", "🍲", "🍜", "🥗", "🍳", "🥓", "🧆", "🍝"] },
  { titel: "Süßes & Kuchen", icons: ["🍰", "🧁", "🍮", "🍦", "🍨", "🍩", "🍪", "🥐", "🥧", "🍫", "🍬", "🍭", "🍯", "🥞", "🧇", "🍺"] },
  { titel: "Obst", icons: ["🍎", "🍇", "🍓", "🍑", "🍉", "🍌", "🍒", "🍐", "🥕", "🌰"] },
  { titel: "Fest & Sonstiges", icons: ["🎪", "🎡", "🎉", "🎈", "🔥", "🎶", "🏷️", "🛒", "💶", "🎟️", "⭐", "🍽️", "📦", "🧾", "🎯", "🏆"] },
];

/** Icon-Auswahl per Klick + optionales Eigen-Emoji. Leerer Wert = kein Icon. */
export function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="h-11 w-11 shrink-0 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center text-2xl">
          {value || "🏷️"}
        </span>
        <input
          className="input flex-1 text-center text-xl"
          placeholder="eigenes Emoji"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Eigenes Emoji als Icon"
        />
        {value && (
          <button type="button" className="btn-ghost py-1.5 text-sm shrink-0" onClick={() => onChange("")}>
            Kein Icon
          </button>
        )}
      </div>
      <div className="max-h-56 overflow-y-auto space-y-2 pr-1 rounded-lg border border-neutral-800 p-2">
        {ICON_GRUPPEN.map((g) => (
          <div key={g.titel}>
            <div className="text-[11px] uppercase tracking-wide text-neutral-500 mb-1">{g.titel}</div>
            <div className="grid grid-cols-8 gap-1">
              {g.icons.map((ic, i) => (
                <button
                  key={`${ic}-${i}`}
                  type="button"
                  onClick={() => onChange(ic)}
                  className={`h-9 rounded-lg text-xl flex items-center justify-center border transition ${
                    value === ic
                      ? "border-brand-600 bg-brand-600/20"
                      : "border-neutral-700 bg-neutral-800 hover:border-neutral-500"
                  }`}
                  aria-label={`Icon ${ic}`}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
