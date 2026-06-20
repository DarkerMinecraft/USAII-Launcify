import type { Metadata } from "next";
import { Spectral, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import { Auth0Provider } from "@auth0/nextjs-auth0";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Sidebar } from "@/components/sidebar";

const hankenGrotesk = Hanken_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const spectral = Spectral({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Launchify — AI Startup Co-Pilot",
  description: "Stress-test your startup idea with AI agents before the market does.",
};

const RootLayout = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => {
  return (
    <html
      lang="en"
      className={cn(
        "h-full antialiased",
        hankenGrotesk.variable,
        jetbrainsMono.variable,
        spectral.variable
      )}
    >
      <body className="h-full flex bg-background text-foreground font-sans overflow-x-auto">
        <Auth0Provider>
          <Sidebar />
          <main className="flex-1 min-h-screen overflow-auto min-w-0">{children}</main>
        </Auth0Provider>
      </body>
    </html>
  );
};
export default RootLayout;
