import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

// Police Nunito — identique au thème Hyper du projet Laravel. Auto-hébergée au
// build par next/font : pas de requête vers fonts.googleapis.com au chargement.
const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-nunito",
});

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
    <html lang="fr" className={`h-full ${nunito.variable}`}>
      <body className="h-full bg-[#fafbfe] antialiased font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
