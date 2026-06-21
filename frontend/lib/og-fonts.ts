/**
 * Loads Spectral Bold from Google Fonts for use in ImageResponse / next/og.
 * The two fetch() calls are cached by Next.js for 24 h so they only hit
 * the network once per deploy cycle.
 */
export async function spectralBold(): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      "https://fonts.googleapis.com/css2?family=Spectral:wght@700&display=swap",
      {
        headers: {
          // Modern UA so Google Fonts returns woff2, not legacy woff/ttf
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        },
        next: { revalidate: 86400 },
      },
    ).then((r) => r.text());

    const url = css.match(/src: url\(([^)]+\.woff2)\)/)?.[1];
    if (!url) return null;

    return fetch(url, { next: { revalidate: 86400 } }).then((r) =>
      r.arrayBuffer(),
    );
  } catch {
    return null;
  }
}
