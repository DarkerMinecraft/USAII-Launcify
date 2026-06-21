import type { ReactElement } from "react";
import type { FontResult } from "@/lib/og-fonts";

export const logoMark = (
  size: number,
  radius: number,
  fontSize: number,
  font: FontResult,
  canvasWidth?: number,
  canvasHeight?: number,
): ReactElement => {
  const logoDiv = {
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
        flexShrink: 0,
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
  };

  if (!canvasWidth || !canvasHeight || (canvasWidth === size && canvasHeight === size)) {
    return logoDiv as unknown as ReactElement;
  }

  return {
    type: "div",
    props: {
      style: {
        width: canvasWidth,
        height: canvasHeight,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      },
      children: logoDiv,
    },
  } as unknown as ReactElement;
};
