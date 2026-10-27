import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Board95 | Buses, taxis and car hire in Malawi",
  description:
    "Find and book buses and shared taxis between Blantyre, Lilongwe and Mzuzu.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen flex flex-col">
        <Header />
        <main className="site-main flex-1 mx-auto w-full">{children}</main>
        <footer className="site-footer border-t border-black/10 text-center text-sm">
          Board95 · Blantyre · Lilongwe · Mzuzu
        </footer>
      </body>
    </html>
  );
}
