import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Limit Canvas",
  description: "Compose 1inch Limit Order Protocol extension strategies",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <header className="studio-shell">
          <nav className="studio-nav">
            <Link href="/" className="studio-nav-brand">
              <span className="studio-mark" aria-hidden="true">
                ◆
              </span>
              Limit Canvas
            </Link>
            <span className="studio-nav-tag">1inch · LOP v4.3.2</span>
            <div className="studio-nav-links">
              <Link href="/">Compose</Link>
              <Link href="/test">Verify</Link>
              <Link href="/?phase=ship">Deploy</Link>
            </div>
          </nav>
        </header>
        <main className="studio-main">{children}</main>
      </body>
    </html>
  );
}
