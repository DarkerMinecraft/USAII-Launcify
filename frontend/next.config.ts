import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Strict Mode double-invokes effects in development, which opens two
  // simultaneous Live API WebSocket connections and puts them in a fight loop.
  reactStrictMode: false,
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
