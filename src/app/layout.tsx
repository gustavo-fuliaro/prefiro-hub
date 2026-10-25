import type { Metadata } from "next";
import { Bricolage_Grotesque, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const plex = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex" });
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], weight: ["600", "800"], variable: "--font-bricolage" });

export const metadata: Metadata = {
  title: { default: "Prefiro Hub", template: "%s · Prefiro Hub" },
  description: "Acompanhe e compare vários perfis do Instagram.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${plex.variable} ${bricolage.variable}`}>
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
