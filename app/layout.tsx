import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Chess", template: "%s · Chess" },
  description:
    "Play chess on one board, against the computer, or through a private online invite. No sign-in required.",
  applicationName: "Chess",
};

export const viewport: Viewport = {
  themeColor: "#0c0a09",
  colorScheme: "dark",
};

// RootLayout wraps every route. The body classes provide the dark background
// and smoothing used by the chess board UI.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-stone-950 min-h-screen antialiased">{children}</body>
    </html>
  );
}
