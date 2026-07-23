import type { ReactNode } from "react";

// Einheitliche Badges/Pillen für die ganze App (statt kopierter Klassen-Strings).
const TON: Record<string, string> = {
  neutral: "bg-neutral-700 text-neutral-200",
  gut: "bg-brand-600/20 text-brand-50",
  warnung: "bg-amber-500/20 text-amber-200",
  gefahr: "bg-red-700/30 text-red-200",
  live: "bg-brand-600/20 text-brand-50",
};

export function Badge({ ton = "neutral", children }: { ton?: keyof typeof TON; children: ReactNode }) {
  return <span className={`badge ${TON[ton] ?? TON.neutral}`}>{children}</span>;
}

/** „aktiv"/„inaktiv"-Badge – überall gleich. */
export function AktivBadge({ aktiv, onClick }: { aktiv: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      className={`badge ${aktiv ? TON.gut : TON.neutral}`}
      onClick={onClick}
      disabled={!onClick}
    >
      {aktiv ? "aktiv" : "inaktiv"}
    </button>
  );
}

/** „● Live"-Badge für Live-Ansichten. */
export function LiveBadge() {
  return <span className={`badge ${TON.live}`}>● Live</span>;
}
