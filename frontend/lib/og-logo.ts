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
        overflow: "hidden",
      },
      children: {
        type: "span",
        props: {
          style: {
            fontFamily: font.name,
            fontWeight: 700,
            fontSize,
            color: "#0f0e0c",
            lineHeight: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
            textAlign: "center",
          },
          children: "L",
        },
      },
    },
  } as unknown as ReactElement;
};
