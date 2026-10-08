import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import { Suspense } from "react";
import Toast from "@/components/Toast";
import "./globals.css";

const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NexusCX AI",
  description: "Multi-agent customer service platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${figtree.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <Suspense fallback={null}><Toast /></Suspense>
      </body>
    </html>
  );
}
