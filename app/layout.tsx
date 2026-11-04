import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "./moga-workflow.css";
import "./palette-2.css";
import "./palette-3.css";
import "./qoves-reference.css";
import palette from "@/config/palette.json";

// Brand System v1.0 (Clinic Next Face brand guide, applied to Moga) — five
// intentional typographic roles, never one font everywhere. See globals.css's
// @theme block for how each maps to a --font-* token / Tailwind utility.
const geistMono = localFont({src:"../public/fonts/geist-mono.ttf",variable:"--font-geist-mono",display:"swap"});
const cormorantGaramond = localFont({src:[{path:"../public/fonts/cormorant.ttf",style:"normal"},{path:"../public/fonts/cormorant-italic.ttf",style:"italic"}],variable:"--font-cormorant",display:"swap"});
const playfairDisplay = localFont({src:"../public/fonts/playfair.ttf",variable:"--font-playfair",display:"swap"});
const cinzel = localFont({src:"../public/fonts/cinzel.ttf",variable:"--font-cinzel",display:"swap"});
const dmSans = localFont({src:"../public/fonts/dm-sans.ttf",variable:"--font-dm-sans",display:"swap"});
const josefinSans = localFont({src:"../public/fonts/josefin.ttf",variable:"--font-josefin",display:"swap"});

export const metadata: Metadata = {
  title: "MOGA — Improve Your Looks Without Surgery",
  description:
    "Get your personalized facial analysis based on your unique features. Objective aesthetic advice and a non-surgical transformation protocol tailored to your face.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en" data-moga-palette={palette.active}
      className={`${geistMono.variable} ${cormorantGaramond.variable} ${playfairDisplay.variable} ${cinzel.variable} ${dmSans.variable} ${josefinSans.variable} h-full scroll-smooth antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">{children}</body>
    </html>
  );
}
