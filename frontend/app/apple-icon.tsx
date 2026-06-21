import { ImageResponse } from "next/og";
import { spectralBold } from "@/lib/og-fonts";
import { logoMark } from "@/lib/og-logo";

export const dynamic = "force-dynamic";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const AppleIcon = async () => {
  const font = await spectralBold();
  return new ImageResponse(logoMark(180, 38, 112, font), {
    ...size,
    fonts: [{ name: font.name, data: font.data, weight: 700, style: "normal" }],
  });
};

export default AppleIcon;
