import type { VoiceProvider } from "roby-face";

// La voce della TV: speechSynthesis del browser, oppure un endpoint audio (Piper sul Raspberry, fase 8)
// se il kiosk apre /casa?voce=http://localhost:5002/?text= (il testo viene aggiunto in fondo, codificato).
export async function tvVoice(url?: string | null): Promise<VoiceProvider> {
  const m = await import("roby-face"); // solo browser
  return url ? m.audioUrlProvider((text) => url + encodeURIComponent(text)) : m.webSpeechProvider;
}

/** Dice una frase senza volto (per gli annunci). Gli errori della voce non fermano la TV. */
export async function say(text: string, url?: string | null) {
  try {
    const voice = await tvVoice(url);
    await voice.speak(text, { lang: "it-IT", signal: new AbortController().signal, onLevel: () => {} });
  } catch {}
}
