"use client";

import { useEffect, useRef } from "react";

// "Neve" al cambio canale: rumore in bianco e nero su un canvas piccolo, ingrandito a pixel,
// più un fruscio breve in Web Audio. Dura ~450 ms. Con "riduci movimento": niente neve, solo il cambio.
const W = 240, H = 160, MS = 450;

let audio: AudioContext | undefined;
function hiss(duration: number) {
  try {
    audio ??= new AudioContext();
    const buffer = audio.createBuffer(1, Math.floor(audio.sampleRate * duration), audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = audio.createBufferSource();
    const gain = audio.createGain();
    gain.gain.value = 0.12;
    src.buffer = buffer;
    src.connect(gain).connect(audio.destination);
    src.start();
  } catch {} // senza audio (policy di autoplay) resta la neve
}

export default function Snow({ trigger, sound = true }: { trigger: number; sound?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!trigger || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const c = canvas.current!;
    const ctx = c.getContext("2d")!;
    const img = ctx.createImageData(W, H);
    const end = performance.now() + MS;
    let frame = 0;
    c.style.opacity = "1";
    if (sound) hiss(MS / 1000);
    const draw = (t: number) => {
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      if (t < end) frame = requestAnimationFrame(draw);
      else c.style.opacity = "0";
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [trigger, sound]);

  return (
    <canvas ref={canvas} width={W} height={H} aria-hidden
      className="pointer-events-none fixed inset-0 z-30 h-full w-full opacity-0 [image-rendering:pixelated]" />
  );
}
