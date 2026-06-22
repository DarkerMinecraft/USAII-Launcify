import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(self), geolocation=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: "/favicon.ico", destination: "/icon?width=32&height=32", permanent: false },
    ];
  },
  // Strict Mode double-invokes effects in development, which opens two
  // simultaneous Live API WebSocket connections and puts them in a fight loop.
  reactStrictMode: false,
  turbopack: {
    root: __dirname,
  },
  webpack(config) {
    // Auth0 v4's DPoP utility uses a dynamic require() expression that
    // webpack can't statically analyze — it's intentional (optional peer dep).
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      { module: /dpopUtils/ },
    ];
    return config;
  },
  // next.config.js
  allowedDevOrigins: ["launchify.darkermine.dev"],
};

export default nextConfig;
