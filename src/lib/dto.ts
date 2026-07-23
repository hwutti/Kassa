// Datentransfer-Objekte für den Client. Bewusst schlank – nur was die Kasse braucht.

export type VerkaufsbereichDTO = {
  id: string;
  name: string;
};

/** Schlanke Referenz auf einen Arbeits-/Verkaufsbereich (nur id + Name). */
export type BereichRef = {
  id: string;
  name: string;
};

/** Veranstaltung mit Aktiv-Kennzeichnung (für Filter/Listen). */
export type VeranstaltungRef = {
  id: string;
  name: string;
  aktiv: boolean;
};

export type ProduktDTO = {
  id: string;
  name: string;
  beschreibung: string | null;
  preisCent: number; // in der Kasse immer gesetzt (nie NULL)
  kategorieId: string;
  icon: string | null;
  bildUrl: string | null;
};

export type KategorieDTO = {
  id: string;
  name: string;
  farbe: string | null;
  icon: string | null;
};

export type KassenDatenDTO = {
  verkaufsbereich: VerkaufsbereichDTO;
  kategorien: KategorieDTO[];
  produkte: ProduktDTO[];
  /** Serverzeit – hilft dem Client, veraltete Caches zu erkennen. */
  stand: string;
};
