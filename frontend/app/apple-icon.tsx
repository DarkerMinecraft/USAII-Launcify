import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: "#ede9e0",
          borderRadius: 38,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Georgia, serif",
          fontWeight: 700,
          fontSize: 112,
          color: "#0f0e0c",
          lineHeight: 1,
          paddingBottom: 4,
        }}
      >
        L
      </div>
    ),
    { ...size },
  );
}
