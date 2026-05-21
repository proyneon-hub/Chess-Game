import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

// Metadata is consumed by Next.js to populate the document title and default
// description tags for this app.
export const metadata: Metadata = {
  title: "Chess",
  description: "A chess game built with Next.js",
};

// RootLayout wraps every route. The body classes provide the dark background
// and smoothing used by the chess board UI.
export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-stone-950 min-h-screen antialiased">{children}</body>
    </html>
  );
}
