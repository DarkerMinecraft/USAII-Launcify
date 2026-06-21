import type { MetadataRoute } from "next";

const sitemap = (): MetadataRoute.Sitemap => [
  {
    url: "https://launchify.darkermine.dev",
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 1,
  },
  {
    url: "https://launchify.darkermine.dev/war-room",
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.8,
  },
];

export default sitemap;
