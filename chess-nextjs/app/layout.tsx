import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chess",
  description: "A chess game built with Next.js",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-stone-950 min-h-screen antialiased">{children}</body>
    </html>
  );
}
