import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "כולל — מעקב תשלומים",
  description: "מערכת מעקב תשלומים ופוטנציאלים",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
