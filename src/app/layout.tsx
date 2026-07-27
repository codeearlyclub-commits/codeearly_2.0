import type { Metadata } from "next";
import { Nunito, Plus_Jakarta_Sans } from "next/font/google";

import "@/styles/tokens.css";
import "./globals.css";

/**
 * Fonts are self-hosted by next/font rather than pulled from Google at runtime
 * as V4 did. That removes a render-blocking third-party request on every page
 * load — which matters a great deal for parents on Nigerian mobile networks —
 * and eliminates the flash of fallback text that an @import cannot avoid.
 */
const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
  variable: "--font-nunito",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "CodeEarly Club — Coding for kids",
    template: "%s · CodeEarly Club",
  },
  description:
    "CodeEarly Club teaches children to code — courses, live classes, holiday programs and competitions for young learners.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${nunito.variable} ${jakarta.variable}`}>
      <body>{children}</body>
    </html>
  );
}
