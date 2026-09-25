"use client";

import { useEffect, useRef } from "react";
import type { ExpressionId } from "roby-face/engine";
import type { RobyFaceElement } from "roby-face";
import { tvVoice } from "./voice";

// Canale 6: Roby a tutto schermo che legge il riepilogo. Riparte ogni volta che si torna sul canale.
export default function RobyChannel({ expression, text, voiceUrl, speakKey }:
  { expression: ExpressionId; text: string; voiceUrl?: string | null; speakKey: number }) {
  const face = useRef<RobyFaceElement>(null);

  useEffect(() => {
    let alive = true;
    const el = face.current;
    (async () => {
      const voice = await tvVoice(voiceUrl);
      if (!alive || !el) return;
      el.voice = voice;
      el.speak(text).catch(() => {}); // senza voce (autoplay bloccato) resta il testo
    })();
    return () => {
      alive = false;
      el?.stop();
    };
    // Si parla quando si entra nel canale, non a ogni aggiornamento dei dati.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speakKey]);

  return (
    <main className="grid h-[100dvh] grid-cols-12 items-center gap-10 p-[calc(2.5rem+var(--overscan))]">
      <h1 className="sr-only">Roby</h1>
      <roby-face ref={face} expression={expression} className="col-span-5 w-full" />
      <p aria-live="polite" className="col-span-7 text-5xl leading-tight font-medium">{text}</p>
    </main>
  );
}
