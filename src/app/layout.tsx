import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CodeEarly 2.0",
  description: "Rebuild — Next.js + Postgres + Redis + Docker",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
