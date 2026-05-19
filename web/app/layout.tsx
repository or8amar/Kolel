import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "כולל — מעקב תשלומים",
  description: "מערכת מעקב תשלומים ופוטנציאלים",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
