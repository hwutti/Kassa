import { abonnieren } from "@/lib/ereignisse";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

/** GET /api/ereignisse – Server-Sent-Events-Stream: signalisiert Änderungen (Live-Update). */
export async function GET() {
  const encoder = new TextEncoder();
  let abmelden: (() => void) | undefined;
  let ping: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const sende = (zeile: string) => {
        try {
          controller.enqueue(encoder.encode(zeile));
        } catch {
          /* Stream geschlossen */
        }
      };
      sende(": verbunden\n\n");
      abmelden = abonnieren(sende);
      // Keep-alive, damit Proxies die Verbindung nicht schließen.
      ping = setInterval(() => sende(": ping\n\n"), 25000);
    },
    cancel() {
      abmelden?.();
      if (ping) clearInterval(ping);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // nginx: kein Buffering
    },
  });
}
