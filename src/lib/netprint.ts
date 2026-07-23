import net from "node:net";

/** Optionalen Port aus "192.168.1.50:9100" lesen (Standard 9100 = RAW/JetDirect). */
export function parseDruckerAdresse(ip: string): { host: string; port: number } {
  const [host, portStr] = ip.split(":");
  const port = portStr ? Number(portStr) : 9100;
  return { host: host.trim(), port: Number.isFinite(port) && port > 0 ? port : 9100 };
}

/**
 * Sendet rohe (ESC/POS-)Bytes per TCP an einen Netzwerkdrucker (RAW/Port 9100).
 * Löst nach vollständigem Senden auf; wirft bei Timeout/Verbindungsfehler.
 */
export function sendeAnDrucker(ip: string, daten: Buffer, timeoutMs = 5000): Promise<void> {
  const { host, port } = parseDruckerAdresse(ip);
  return new Promise((resolve, reject) => {
    let fertig = false;
    const socket = net.createConnection({ host, port }, () => {
      socket.write(daten, () => socket.end());
    });
    socket.setTimeout(timeoutMs);
    socket.on("timeout", () => {
      socket.destroy();
      if (!fertig) {
        fertig = true;
        reject(new Error("Zeitüberschreitung – Drucker nicht erreichbar."));
      }
    });
    socket.on("error", (e) => {
      if (!fertig) {
        fertig = true;
        reject(new Error("Drucker nicht erreichbar: " + e.message));
      }
    });
    socket.on("close", () => {
      if (!fertig) {
        fertig = true;
        resolve();
      }
    });
  });
}
