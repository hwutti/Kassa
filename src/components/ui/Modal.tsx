"use client";

import { useEffect, type ReactNode } from "react";

/**
 * Gemeinsames Dialog-Overlay für die ganze App.
 * variant "center" = mittig; "sheet" = auf dem Handy unten andockend.
 * onSchliessen (optional) schließt zusätzlich per Escape-Taste.
 */
export function Modal({
  variant = "center",
  onSchliessen,
  cardClass = "w-full max-w-md",
  children,
}: {
  variant?: "center" | "sheet";
  onSchliessen?: () => void;
  cardClass?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!onSchliessen) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSchliessen();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onSchliessen]);

  const lage = variant === "sheet" ? "items-end sm:items-center p-0 sm:p-4" : "items-center p-4";
  const kante = variant === "sheet" ? "rounded-b-none sm:rounded-2xl" : "";
  return (
    <div className={`fixed inset-0 z-50 flex justify-center bg-black/70 ${lage}`}>
      <div className={`card ${kante} ${cardClass}`}>{children}</div>
    </div>
  );
}
