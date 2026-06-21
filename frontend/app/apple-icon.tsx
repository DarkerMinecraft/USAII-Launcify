import { ImageResponse } from "next/og";
import { spectralBold } from "@/lib/og-fonts";
import { logoMark } from "@/lib/og-logo";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  const font = await spectralBold();
  return new ImageResponse(logoMark(180, 38, 112, font), {
    ...size,
    fonts: font ? [{ name: "Spectral", data: font, weight: 700, style: "normal" }] : [],
  });
}
