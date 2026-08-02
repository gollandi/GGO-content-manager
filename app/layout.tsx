import type { Metadata } from "next";
import { Archivo, Archivo_Narrow, Bodoni_Moda } from "next/font/google";
import "./globals.css";
import Providers from "../components/Providers";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-archivo"
});

const archivoNarrow = Archivo_Narrow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-archivo-narrow"
});

const bodoni = Bodoni_Moda({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-bodoni"
});

export const metadata: Metadata = {
  title: "GGO Med Content Manager",
  description: "Advanced content management and compliance tracking for GGOMed"
};

/**
 * The direction contract. Emitted as a real HTML comment so it survives the
 * production build and can be audited with a grep for the seed key.
 */
const DIRECTION_CONTRACT = `<!--
  IMPECCABLE DIRECTION CONTRACT
  THESIS: This cockpit is the register the house is signed into, not a dashboard
  about it. It refuses the sidebar + KPI tiles + filterable table arrangement.
  OWN-WORLD: Intaglio blue-black plate, generated guilloche, safety paper only
  where a real document sits, oxblood reserved for sealing alone, violet stamps
  for state. Square corners, engraved hairlines. No shadows, gradients or pills.
  Bodoni Moda / Archivo Narrow / Archivo.
  STORY: JJ reads which rooms want him from the counterfoil wall, opens that
  room's register, sees the asset at document scale, and seals it or sends it back.
  FIRST VIEWPORT: The counterfoil wall. One perforated stub per room on the
  plate; tally marks for volume; seal sockets reading pending against sealed;
  torn oxblood stubs marking the rooms that need attention.
  FORM: Il Registro, candidate 3 of the grounded list, seed key 9055bf41.
  FINISH: unreviewed and undocumented is unfinished; this build ends with the
  finish review, the verdict, and DESIGN.md
-->`;

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${archivoNarrow.variable} ${bodoni.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans bg-plate text-plate-foreground antialiased">
        <div hidden dangerouslySetInnerHTML={{ __html: DIRECTION_CONTRACT }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
