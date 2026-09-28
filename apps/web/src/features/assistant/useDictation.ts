"use client";

import { useRef, useState, useSyncExternalStore } from "react";

// "Premi e parla" nella PWA: il riconoscimento vocale del browser (Chrome su Android, Safari su iOS).
// Dà solo testo: poi passa dallo stesso interprete del campo scritto. Il Pi invece ascolta in locale (services/voice).
// ponytail: tipi minimi scritti qui, lib.dom di TypeScript non ha ancora SpeechRecognition.
type Result = { isFinal: boolean; 0: { transcript: string } };
type Recognition = {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<Result> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void; stop(): void; abort(): void;
};
type Ctor = new () => Recognition;

const ctor = () => (typeof window === "undefined" ? undefined
  : ((window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor }).SpeechRecognition
    ?? (window as unknown as { webkitSpeechRecognition?: Ctor }).webkitSpeechRecognition));

export function useDictation({ onPartial, onFinal }: { onPartial: (text: string) => void; onFinal: (text: string) => void }) {
  const supported = useSyncExternalStore(() => () => {}, () => !!ctor(), () => false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const rec = useRef<Recognition | null>(null);

  function start() {
    const C = ctor();
    if (!C || rec.current) return;
    const r = new C();
    r.lang = "it-IT";
    r.interimResults = true;
    r.continuous = false; // si ferma da solo quando smetti di parlare
    let finalText = "";
    r.onresult = (e) => {
      let partial = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]!;
        if (res.isFinal) finalText += res[0].transcript;
        else partial += res[0].transcript;
      }
      onPartial((finalText + partial).trim());
    };
    r.onerror = (e) => setError(e.error === "not-allowed" ? "Serve il permesso di usare il microfono." : e.error === "no-speech" ? "Non ho sentito niente." : "Il riconoscimento vocale non ha funzionato.");
    r.onend = () => {
      rec.current = null;
      setListening(false);
      if (finalText.trim()) onFinal(finalText.trim());
    };
    setError("");
    rec.current = r;
    setListening(true);
    r.start();
  }

  return { supported, listening, error, start, stop: () => rec.current?.stop() };
}
