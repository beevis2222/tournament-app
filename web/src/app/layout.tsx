import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Starter",
  description: "Golf tournament manager for private clubs",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
