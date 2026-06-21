import { ImageResponse } from "next/og";
import { spectralBold } from "@/lib/og-fonts";
import { logoMark } from "@/lib/og-logo";

export const size = { width: 32, height: 32 };
export const contentType = "image/x-icon";

export default async function Icon() {
  const font = await spectralBold();
  return new ImageResponse(logoMark(32, 7, 20, font), {
    ...size,
    fonts: font ? [{ name: "Spectral", data: font, weight: 700, style: "normal" }] : [],
  });
}
