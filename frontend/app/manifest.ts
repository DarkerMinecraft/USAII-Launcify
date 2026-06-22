import type { MetadataRoute } from "next";

const manifest = (): MetadataRoute.Manifest => ({
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
      src: "/icon?width=192&height=192",
      sizes: "192x192",
      type: "image/png",
      purpose: "any",
    },
    {
      src: "/icon?width=192&height=192",
      sizes: "192x192",
      type: "image/png",
      purpose: "maskable",
    },
    {
      src: "/icon?width=512&height=512",
      sizes: "512x512",
      type: "image/png",
      purpose: "any",
    },
  ],
});

export default manifest;
