import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/war-room/session/", "/launchpad", "/pitch-session"],
    },
    sitemap: "https://launchify.darkermine.dev/sitemap.xml",
  };
}
