/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
