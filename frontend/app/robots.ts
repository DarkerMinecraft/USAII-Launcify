import type { MetadataRoute } from "next";

const robots = (): MetadataRoute.Robots => ({
  rules: {
    userAgent: "*",
    allow: "/",
    disallow: ["/war-room/session/", "/launchpad", "/pitch-session"],
  },
  sitemap: "https://launchify.darkermine.dev/sitemap.xml",
});

export default robots;
