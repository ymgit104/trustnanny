import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TrustNanny",
  description: "Childcare that never doesn't show up.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
