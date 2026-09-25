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
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
