// Da dove arriva la voce. Il volto chiama speak() e anima la bocca con onLevel:
// un numero 0..1 muove gli occhi al ritmo dell'audio, null lascia le sillabe procedurali del motore.
export interface VoiceProvider {
  speak(text: string, opts: { lang: string; signal: AbortSignal; onLevel: (level: number | null) => void }): Promise<void>;
}

// Sintesi vocale del browser: gratuita, nessun audio da misurare, quindi sillabe procedurali.
export const webSpeechProvider: VoiceProvider = {
  speak(text, { lang, signal, onLevel }) {
    return new Promise((resolve, reject) => {
      if (signal.aborted) return resolve();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      const voice = speechSynthesis.getVoices().find((v) => v.lang.replace("_", "-").startsWith(lang));
      if (voice) u.voice = voice;
      onLevel(null);
      u.onend = () => resolve();
      // "interrupted" e "canceled" arrivano da stop() o da un nuovo speak(): non sono errori.
      u.onerror = (e) => (e.error === "interrupted" || e.error === "canceled" ? resolve() : reject(new Error(e.error)));
      signal.addEventListener("abort", () => speechSynthesis.cancel(), { once: true });
      speechSynthesis.cancel(); // Chrome a volte resta in pausa dopo un cancel precedente
      speechSynthesis.speak(u);
    });
  },
};

// Qualsiasi endpoint che restituisce audio (es. Piper sul Raspberry): lip-sync vero dall'ampiezza.
// gain: taratura, alzalo se il volto reagisce poco, abbassalo se satura (1.6 come in Roby).
export function audioUrlProvider(url: (text: string, lang: string) => string, gain = 1.6): VoiceProvider {
  let ctx: AudioContext | undefined;
  return {
    async speak(text, { lang, signal, onLevel }) {
      const res = await fetch(url(text, lang), { signal });
      if (!res.ok) throw new Error(`Voce: HTTP ${res.status}`);
      ctx ??= new AudioContext();
      await ctx.resume();
      const buffer = await ctx.decodeAudioData(await res.arrayBuffer());
      if (signal.aborted) return;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      const stop = meter(ctx, src, gain, onLevel);
      await new Promise<void>((resolve) => {
        src.onended = () => resolve();
        signal.addEventListener("abort", () => src.stop(), { once: true });
        src.start();
      });
      stop();
    },
  };
}

// Volume 0..1 da un nodo audio, a ogni frame (da Roby, lib/audio.ts). Restituisce la funzione per fermarsi.
function meter(ctx: AudioContext, node: AudioNode, gain: number, onLevel: (level: number) => void) {
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  node.connect(analyser);
  const samples = new Float32Array(analyser.fftSize);
  let frame = 0;
  const loop = () => {
    analyser.getFloatTimeDomainData(samples);
    let sum = 0;
    for (const s of samples) sum += s * s;
    onLevel(Math.min(1, Math.sqrt(Math.sqrt(sum / samples.length)) * gain));
    frame = requestAnimationFrame(loop);
  };
  loop();
  return () => {
    cancelAnimationFrame(frame);
    node.disconnect(analyser);
    onLevel(0);
  };
}
