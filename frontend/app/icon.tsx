import { ImageResponse } from "next/og";
import { spectralBold } from "@/lib/og-fonts";
import { logoMark } from "@/lib/og-logo";

export const dynamic = "force-dynamic";
export const size = { width: 32, height: 32 };
export const contentType = "image/x-icon";

const Icon = async () => {
  const font = await spectralBold();
  return new ImageResponse(logoMark(32, 7, 20, font), {
    ...size,
    fonts: [{ name: font.name, data: font.data, weight: 700, style: "normal" }],
  });
};

export default Icon;
