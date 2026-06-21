import type { ReactElement } from "react";
import type { FontResult } from "@/lib/og-fonts";

/**
 * Returns the JSX element used by ImageResponse for every icon size.
 */
export const logoMark = (
  size: number,
  radius: number,
  fontSize: number,
  font: FontResult,
): ReactElement => {
  return {
    type: "div",
    props: {
      style: {
        width: size,
        height: size,
        background: "#ede9e0",
        borderRadius: radius,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: font.name,
        fontWeight: 700,
        fontSize,
        color: "#0f0e0c",
        lineHeight: 1,
        paddingBottom: Math.round(size * 0.03),
      },
      children: "L",
    },
  } as unknown as ReactElement;
};
