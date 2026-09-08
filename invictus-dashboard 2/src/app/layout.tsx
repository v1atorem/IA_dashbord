import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Invictus Dashboard",
  description: "Аналитика лидов и продаж: amoCRM + Facebook по направлениям",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
