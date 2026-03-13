import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FitConquest — Conquer Your Fitness Goals",
  description:
    "FitConquest helps you track, train, and transform. A premium fitness companion built for champions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Animated background elements */}
        <div className="bg-grid" />
        <div className="bg-glow bg-glow-1" />
        <div className="bg-glow bg-glow-2" />

        {/* Navbar */}
        <nav className="navbar" id="navbar">
          <Link href="/" className="navbar-logo">
            FitConquest
          </Link>
          <ul className="navbar-links">
            <li>
              <Link href="/feature1">Feature 1</Link>
            </li>
            <li>
              <Link href="/feature2">Feature 2</Link>
            </li>
          </ul>
        </nav>

        {children}
      </body>
    </html>
  );
}
