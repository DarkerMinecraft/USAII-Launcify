import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Launchify — AI Startup Co-Pilot",
    short_name: "Launchify",
    description:
      "Stress-test your startup idea with three AI advisors before the market does.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0f0e0c",
    theme_color: "#ede9e0",
    categories: ["productivity", "business"],
    icons: [
      {
        src: "/api/pwa-icon?size=192",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/api/pwa-icon?size=512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
