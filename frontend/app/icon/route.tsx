import { ImageResponse } from "next/og";
import { type NextRequest } from "next/server";
import { spectralBold } from "@/lib/og-fonts";
import { logoMark } from "@/lib/og-logo";

export const runtime = "nodejs";

const MAX_DIM = 4000;

export const GET = async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);

  const w = Math.min(Math.max(Number(searchParams.get("width")) || 32, 1), MAX_DIM);
  const h = Math.min(Math.max(Number(searchParams.get("height")) || 32, 1), MAX_DIM);

  const size = Math.min(w, h);
  const radius = Math.round(size * 0.213);
  const fontSize = Math.round(size * 0.625);
  const font = await spectralBold();

  return new ImageResponse(logoMark(size, radius, fontSize, font), {
    width: w,
    height: h,
    fonts: [{ name: font.name, data: font.data, weight: 700, style: "normal" }],
  });
};
