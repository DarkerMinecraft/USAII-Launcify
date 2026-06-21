import { ImageResponse } from "next/og";
import { spectralBold } from "@/lib/og-fonts";

export const dynamic = "force-dynamic";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const OgImage = async () => {
  const font = await spectralBold();

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: "#0f0e0c",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 28,
          fontFamily: "Spectral",
        }}
      >
        {/* Logo mark */}
        <div
          style={{
            width: 80,
            height: 80,
            background: "#ede9e0",
            borderRadius: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "Spectral",
            fontWeight: 700,
            fontSize: 50,
            color: "#0f0e0c",
            lineHeight: 1,
            paddingBottom: 2,
          }}
        >
          L
        </div>

        {/* Wordmark */}
        <div
          style={{
            fontFamily: "Spectral",
            fontWeight: 700,
            fontSize: 56,
            color: "#ede9e0",
            letterSpacing: "-0.02em",
            lineHeight: 1,
          }}
        >
          Launchify
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 22,
            color: "#7a7670",
            letterSpacing: "0.01em",
            lineHeight: 1,
          }}
        >
          AI Startup Co-Pilot
        </div>

        {/* CTA */}
        <div
          style={{
            marginTop: 12,
            background: "#ede9e0",
            borderRadius: 10,
            padding: "14px 30px",
            fontFamily: "Spectral",
            fontWeight: 700,
            fontSize: 20,
            color: "#0f0e0c",
            letterSpacing: "0.01em",
            lineHeight: 1,
          }}
        >
          Stress-test your idea →
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Spectral", data: font.data, weight: 700, style: "normal" }],
    },
  );
};

export default OgImage;
