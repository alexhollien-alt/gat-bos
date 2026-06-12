import type { Metadata } from "next";
import { Inter, Syne, Space_Mono, Hanken_Grotesk, Newsreader } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const syne = Syne({ subsets: ["latin"], variable: "--font-display", weight: ["600", "700", "800"] });
const spaceMono = Space_Mono({ subsets: ["latin"], variable: "--font-mono", weight: ["400"] });
// GAT-BOS redesign kit (consumed by /new/* via font-hanken / font-newsreader)
const hanken = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-hanken", weight: ["400", "500", "600", "700", "800"] });
const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-newsreader", weight: ["400", "500"], style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: "GAT-BOS",
  description: "Relationship management for title sales executives",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${syne.variable} ${spaceMono.variable} ${hanken.variable} ${newsreader.variable} ${inter.className} antialiased`}>{children}</body>
    </html>
  );
}
