"use client";

/** Kleiner JSON-Fetch-Helfer mit einheitlicher Fehlerbehandlung. */
export async function jsonFetch<T = unknown>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  const text = await res.text();
  const daten = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(daten?.error ?? `Fehler ${res.status}`);
  }
  return daten as T;
}
