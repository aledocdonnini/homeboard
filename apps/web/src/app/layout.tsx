import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";
import ServiceWorker from "@/components/ServiceWorker";
import TabBar from "@/components/TabBar";

// Archivo: grotesk con asse di larghezza, regge i numeri giganti e il testo corrente.
// Stretto (font-stretch 75%) fa da carattere di display: OSD, secondi, tasti.
const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], axes: ["wdth"] });

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
  applicationName: "Homeboard",
  appleWebApp: { capable: true, title: "Homeboard", statusBarStyle: "default" },
  icons: { icon: "/icons/192", apple: "/icons/180" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="it"
      className={`${archivo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ServiceWorker>
          {children}
          <TabBar />
        </ServiceWorker>
      </body>
    </html>
  );
}
