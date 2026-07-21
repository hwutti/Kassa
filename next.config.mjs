/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Zur Laufzeit hochgeladene Bilder (/uploads/*) über eine Route ausliefern,
  // da Next.js im Produktionsbetrieb nur Build-Zeit-Dateien aus public/ serviert.
  async rewrites() {
    return [{ source: "/uploads/:name", destination: "/api/uploads/:name" }];
  },
  async headers() {
    return [
      {
        // Service Worker darf nie zwischengespeichert ausgeliefert werden,
        // damit neue Versionen zuverlässig erkannt werden.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
    ];
  },
};

export default nextConfig;
