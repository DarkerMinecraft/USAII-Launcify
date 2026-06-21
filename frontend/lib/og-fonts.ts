import fs from "fs";
import path from "path";

export type FontResult = { data: ArrayBuffer; name: string };

/**
 * Loads Spectral Bold from the bundled TTF file in public/fonts/.
 * No network calls — works in any environment including AWS with restricted egress.
 */
export async function spectralBold(): Promise<FontResult> {
  const filePath = path.join(process.cwd(), "public", "fonts", "spectral-bold.ttf");
  const data = fs.readFileSync(filePath).buffer as ArrayBuffer;
  return { data, name: "Spectral" };
}
