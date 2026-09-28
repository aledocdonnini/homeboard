import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Homeboard",
    short_name: "Homeboard",
    description: "Spesa, promemoria e scadenze di casa",
    lang: "it",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#e6e4e0",
    theme_color: "#e6e4e0",
    // Android: "Condividi → Homeboard" da un'altra app apre una nota già scritta (Notes.tsx legge i parametri).
    share_target: { action: "/note", method: "GET", params: { title: "titolo", text: "testo", url: "link" } },
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
