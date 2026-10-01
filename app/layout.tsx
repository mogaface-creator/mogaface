import type { Metadata } from "next";
import { Geist_Mono, Cormorant_Garamond, Playfair_Display, Cinzel, DM_Sans, Josefin_Sans } from "next/font/google";
import "./globals.css";

// Brand System v1.0 (Clinic Next Face brand guide, applied to MogaFace) — five
// intentional typographic roles, never one font everywhere. See globals.css's
// @theme block for how each maps to a --font-* token / Tailwind utility.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Title role: hero statements, wordmark, campaign covers — light weight, large. */
const cormorantGaramond = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
});

/** Heading / Subheading role: page-level headings, card and service titles. */
const playfairDisplay = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["700", "900"],
});

/** Section Header role: uppercase eyebrows, nav items, section dividers. */
const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["500"],
});

/** Body role: all long-form and UI copy. */
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

/** Small role: metadata, timestamps, footnotes. */
const josefinSans = Josefin_Sans({
  variable: "--font-josefin",
  subsets: ["latin"],
  weight: ["300", "400"],
});

export const metadata: Metadata = {
  title: "MogaFace — See the change on your own face",
  description:
    "Answer a few questions, share three photos, and see an illustrative after of the places you named. A clinician decides what comes next.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistMono.variable} ${cormorantGaramond.variable} ${playfairDisplay.variable} ${cinzel.variable} ${dmSans.variable} ${josefinSans.variable} h-full scroll-smooth antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">{children}</body>
    </html>
  );
}
