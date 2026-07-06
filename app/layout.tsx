import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Repo Movie Machine",
  description: "Generate a playable commit trend movie from a public GitHub repository."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
