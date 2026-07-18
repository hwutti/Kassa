"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

// App-weite, gestylte Ersatzdialoge für die nativen confirm/prompt/alert.

type ConfirmOptions = {
  titel?: string;
  text: string;
  bestaetigenText?: string;
  abbrechenText?: string;
  gefahr?: boolean; // roter Bestätigen-Button für destruktive Aktionen
};
type PromptOptions = ConfirmOptions & { standard?: string; platzhalter?: string };

type DialogContextTyp = {
  confirm: (o: ConfirmOptions) => Promise<boolean>;
  prompt: (o: PromptOptions) => Promise<string | null>;
  alert: (o: { titel?: string; text: string; bestaetigenText?: string }) => Promise<void>;
};

const DialogContext = createContext<DialogContextTyp | null>(null);

export function useDialog(): DialogContextTyp {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialog muss innerhalb von <DialogProvider> verwendet werden.");
  return ctx;
}

type InternerDialog = {
  typ: "confirm" | "prompt" | "alert";
  titel?: string;
  text: string;
  bestaetigenText?: string;
  abbrechenText?: string;
  gefahr?: boolean;
  standard?: string;
  platzhalter?: string;
  resolve: (wert: boolean | string | null | void) => void;
};

export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<InternerDialog | null>(null);
  const [eingabe, setEingabe] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const confirm = useCallback(
    (o: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setDialog({ typ: "confirm", ...o, resolve: (w) => resolve(Boolean(w)) });
      }),
    [],
  );
  const prompt = useCallback(
    (o: PromptOptions) =>
      new Promise<string | null>((resolve) => {
        setEingabe(o.standard ?? "");
        setDialog({
          typ: "prompt",
          ...o,
          resolve: (w) => resolve(typeof w === "string" ? w : null),
        });
      }),
    [],
  );
  const alert = useCallback(
    (o: { titel?: string; text: string; bestaetigenText?: string }) =>
      new Promise<void>((resolve) => {
        setDialog({ typ: "alert", ...o, resolve: () => resolve() });
      }),
    [],
  );

  function schliessen(wert: boolean | string | null | void) {
    dialog?.resolve(wert);
    setDialog(null);
    setEingabe("");
  }

  // Fokus auf das Eingabefeld bei Prompt.
  useEffect(() => {
    if (dialog?.typ === "prompt") {
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [dialog]);

  function bestaetigen() {
    if (dialog?.typ === "prompt") schliessen(eingabe);
    else if (dialog?.typ === "confirm") schliessen(true);
    else schliessen(undefined);
  }
  function abbrechen() {
    if (dialog?.typ === "prompt") schliessen(null);
    else if (dialog?.typ === "confirm") schliessen(false);
    else schliessen(undefined);
  }

  return (
    <DialogContext.Provider value={{ confirm, prompt, alert }}>
      {children}
      {dialog && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
          onKeyDown={(e) => {
            if (e.key === "Escape") abbrechen();
            if (e.key === "Enter" && dialog.typ !== "alert") bestaetigen();
          }}
        >
          <div className="card w-full max-w-sm p-5 space-y-4" role="dialog" aria-modal="true">
            {dialog.titel && <h2 className="text-lg font-semibold">{dialog.titel}</h2>}
            <p className="text-neutral-200 whitespace-pre-line">{dialog.text}</p>

            {dialog.typ === "prompt" && (
              <input
                ref={inputRef}
                className="input"
                value={eingabe}
                placeholder={dialog.platzhalter}
                onChange={(e) => setEingabe(e.target.value)}
              />
            )}

            <div className="flex gap-2 justify-end pt-1">
              {dialog.typ !== "alert" && (
                <button className="btn-ghost" onClick={abbrechen}>
                  {dialog.abbrechenText ?? "Abbrechen"}
                </button>
              )}
              <button
                className={dialog.gefahr ? "btn-danger" : "btn-primary"}
                onClick={bestaetigen}
                autoFocus={dialog.typ !== "prompt"}
              >
                {dialog.bestaetigenText ?? (dialog.typ === "alert" ? "OK" : "OK")}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}
