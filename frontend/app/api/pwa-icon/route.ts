import { ImageResponse } from "next/og";
import { type NextRequest } from "next/server";
import { spectralBold } from "@/lib/og-fonts";
import { logoMark } from "@/lib/og-logo";

export const runtime = "nodejs";

const ALLOWED = new Set([192, 512]);

export async function GET(req: NextRequest) {
  const raw = new URL(req.url).searchParams.get("size");
  const size = Number(raw);

  if (!ALLOWED.has(size)) {
    return new Response("Invalid size — use 192 or 512", { status: 400 });
  }

  const radius = Math.round(size * 0.213); // ~same ratio as rounded-lg on 32px
  const fontSize = Math.round(size * 0.625);
  const font = await spectralBold();

  return new ImageResponse(logoMark(size, radius, fontSize, font), {
    width: size,
    height: size,
    fonts: font ? [{ name: "Spectral", data: font, weight: 700, style: "normal" }] : [],
  });
}
