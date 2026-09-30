"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { SpotifyLogo } from "@phosphor-icons/react";
import Button from "@/components/ui/Button";
import { CLIENT_ID, connected, disconnect, login } from "@/lib/spotify";

// Collegamento a Spotify di questo dispositivo: poi "metti De André" funziona anche dalla PWA (serve Premium).
export default function SpotifySettings() {
  const [version, setVersion] = useState(0);
  const isConnected = useSyncExternalStore(() => () => {}, () => connected() && version >= 0, () => false);
  const section = useRef<HTMLElement>(null);
  useEffect(() => {
    if (new URLSearchParams(location.search).has("spotify")) section.current?.scrollIntoView({ block: "center" });
  }, []);
  if (!CLIENT_ID) return null; // l'app Spotify non è configurata (NEXT_PUBLIC_SPOTIFY_CLIENT_ID)

  return (
    <section ref={section} aria-labelledby="spotify-title" className="flex flex-col gap-3 lg:border-t-4 lg:border-ink lg:pt-5">
      <h2 id="spotify-title" className="text-xl font-semibold">Spotify</h2>
      <p className="text-muted">
        {isConnected
          ? "Collegato su questo dispositivo: chiedi «metti De André», «pausa», «cosa sta suonando?». Suona sullo Spotify che hai aperto."
          : "Collega il tuo account (serve Premium) per mettere musica chiedendolo a Roby anche da qui. Il collegamento vale per questo dispositivo."}
      </p>
      {isConnected
        ? <Button variant="link" onClick={() => { disconnect(); setVersion((v) => v + 1); }} className="self-start">Scollega Spotify</Button>
        : <Button onClick={() => void login()} className="self-start"><SpotifyLogo aria-hidden weight="bold" className="size-5" /> Collega Spotify</Button>}
    </section>
  );
}
