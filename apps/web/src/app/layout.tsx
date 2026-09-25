import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next, VT323 } from "next/font/google";
import "./globals.css";
import TabBar from "@/components/TabBar";

// Atkinson Hyperlegible Next: disegnato per la leggibilità, serve a colpo d'occhio e sotto il sole.
const atkinson = Atkinson_Hyperlegible_Next({ variable: "--font-atkinson", subsets: ["latin"] });
// VT323: solo per i numeri in stile OSD, sempre grandi.
const vt323 = VT323({ variable: "--font-vt323", subsets: ["latin"], weight: "400" });

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0e11" },
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
      className={`${atkinson.variable} ${vt323.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <TabBar />
      </body>
    </html>
  );
}
