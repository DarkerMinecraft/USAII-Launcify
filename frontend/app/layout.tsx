import type { Metadata, Viewport } from "next";
import { Spectral, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import { Auth0Provider } from "@auth0/nextjs-auth0";
import "./globals.css";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

const hankenGrotesk = Hanken_Grotesk({
  display: "swap",
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  display: "swap",
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const spectral = Spectral({
  display: "swap",
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://launchify.darkermine.dev"),
  title: {
    default: "Launchify — AI Startup Co-Pilot",
    template: "%s — Launchify",
  },
  description: "Stress-test your startup idea with three AI advisors before the market does. Build your Assumption Map, validate risks, and launch faster.",
  openGraph: {
    title: "Launchify — AI Startup Co-Pilot",
    description: "Stress-test your startup idea with three AI advisors before the market does.",
    url: "https://launchify.darkermine.dev",
    siteName: "Launchify",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Launchify — AI Startup Co-Pilot",
    description: "Stress-test your startup idea with three AI advisors before the market does.",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    shortcut: "/favicon.ico",
    icon: [{ url: "/icon", type: "image/png" }],
    apple: "/apple-icon",
  },
};

export const viewport: Viewport = {
  themeColor: "#ede9e0",
};

const RootLayout = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "h-full antialiased",
        hankenGrotesk.variable,
        jetbrainsMono.variable,
        spectral.variable
      )}
    >
      <body className="flex flex-col bg-background text-foreground font-sans overflow-x-hidden">
        <Auth0Provider>
          <TooltipProvider delayDuration={400}>
            {children}
            <Toaster position="bottom-right" />
          </TooltipProvider>
        </Auth0Provider>
      </body>
    </html>
  );
};
export default RootLayout;
