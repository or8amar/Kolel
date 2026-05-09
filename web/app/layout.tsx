import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kolel Payments Tracker",
  description: "מערכת מעקב תשלומים ופוטנציאלים",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he">
      <body>{children}</body>
    </html>
  );
}
