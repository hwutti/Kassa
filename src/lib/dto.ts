// Datentransfer-Objekte für den Client. Bewusst schlank – nur was die Kasse braucht.

export type VerkaufsbereichDTO = {
  id: string;
  name: string;
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
