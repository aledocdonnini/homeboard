import type { Metadata, Viewport } from "next";
import { Archivo, Doto } from "next/font/google";
import "./globals.css";
import TabBar from "@/components/TabBar";

// Archivo: grotesk con asse di larghezza, regge i numeri giganti e il testo corrente.
const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], axes: ["wdth"] });
// Doto: cifre a matrice di punti, solo per le letture degli strumenti.
const doto = Doto({ variable: "--font-doto", subsets: ["latin"] });

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e6e4e0" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0f10" },
  ],
};

export const metadata: Metadata = {
  title: "Homeboard",
  description: "Spesa, promemoria e scadenze di casa",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="it"
      className={`${archivo.variable} ${doto.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <TabBar />
      </body>
    </html>
  );
}
