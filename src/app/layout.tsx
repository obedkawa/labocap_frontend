import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "Labo AnaPath",
  description: "Laboratoire d'Anatomie Pathologique",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full">
      <body className="h-full bg-gray-50 antialiased font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
