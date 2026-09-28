"use client";

import { useEffect, useRef, useState } from "react";
import { Microphone, MicrophoneSlash, Timer, WifiSlash, WarningCircle } from "@phosphor-icons/react";
import type { RobyFaceElement } from "roby-face";
import type { HomeState } from "@homeboard/core/protocol";
import { faceFor, panelKey, pickPanel } from "@homeboard/core/station";
import RobyTile from "@/components/ui/RobyTile";
import Monoscope from "./Monoscope";
import PanelView from "./Panels";
import Snow from "./Snow";
import { useBrain } from "./useBrain";

// La postazione di casa, sul Pi dentro la Crezar (1920×1280, 3:2). Solo vocale: lo schermo mostra e basta.
// Un solo layout: a sinistra ora, Roby e indicatori, sempre fissi; a destra il pannello che sceglie pickPanel
// (packages/core/src/station.ts). Tutto arriva da brain: questa pagina non scrive niente.
export default function HomeView() {
  const face = useRef<RobyFaceElement>(null);
  const { state, connected } = useBrain((level) => face.current?.setSpeechLevel(level));
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    import("roby-face");
    // Taratura dell'overscan dal kiosk: /casa?overscan=6 (in % del lato corto, 0-20).
    const overscan = Number(new URLSearchParams(location.search).get("overscan") ?? NaN);
    if (overscan >= 0 && overscan <= 20) document.documentElement.style.setProperty("--overscan", `${overscan}vmin`);
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  const panel = state ? pickPanel(state, now) : null;
  const key = panel ? panelKey(panel) : "";
  // La neve parte quando cambia cosa mostra il pannello (stato aggiustato durante il render, non in un effetto).
  const [shown, setShown] = useState(key);
  const [snow, setSnow] = useState(0);
  if (key !== shown) {
    setShown(key);
    setSnow(snow + 1);
  }

  if (!state || !panel) return <NoSignal />;
  const { expression, mode } = faceFor(state, panel, now);

  if (panel.kind === "night") {
    return (
      <div className="crt relative h-[100dvh] overflow-hidden bg-black">
        <Monoscope night resume={state.household?.nightEnd} />
        <div className="fixed right-[calc(2.5rem+var(--overscan))] bottom-[calc(2.5rem+var(--overscan))]"><Mic state={state} /></div>
      </div>
    );
  }

  return (
    <div className="crt h-[100dvh] overflow-hidden">
      <main className="grid h-full grid-cols-12 gap-10 p-[calc(2.5rem+var(--overscan))]">
        <aside className="col-span-4 flex min-h-0 flex-col gap-6">
          <p className="flex items-baseline justify-between">
            <time className="text-[clamp(5rem,8vw,9rem)] leading-[0.8] font-semibold tracking-[-0.05em]">
              {now.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
            </time>
            <span className="text-2xl text-muted capitalize">{now.toLocaleDateString("it-IT", { weekday: "long", day: "numeric" })}</span>
          </p>
          <div className="flex min-h-0 flex-1 items-center justify-center rounded-module bg-surface bg-dots p-6">
            <roby-face ref={face} expression={expression} mode={mode} background="transparent" color="currentColor" no-glow=""
              className="aspect-square h-full max-h-full max-w-full text-ink" />
          </div>
          <Status state={state} connected={connected} showTimers={panel.kind !== "timers" && panel.kind !== "ringing"} />
        </aside>
        <section aria-live="polite" className="col-span-8 flex min-h-0 flex-col">
          <PanelView panel={panel} state={state} now={now} />
        </section>
      </main>
      <Snow trigger={snow} />
    </div>
  );
}

/** Il microfono si vede sempre: chi è in casa deve sapere se Roby ascolta. */
function Mic({ state }: { state: HomeState }) {
  if (state.mic === "muted") {
    return (
      <p className="flex items-center gap-3 rounded-control border-2 border-edge px-4 py-2 text-2xl font-semibold text-muted">
        <MicrophoneSlash aria-hidden weight="bold" className="size-8" /> Microfono spento
      </p>
    );
  }
  const listening = state.activity === "listening";
  return (
    <p className={`flex items-center gap-3 rounded-control px-4 py-2 text-2xl font-semibold ${listening ? "bg-accent text-on-accent" : "border-2 border-edge"}`}>
      <Microphone aria-hidden weight={listening ? "fill" : "bold"} className="size-8" />
      {listening ? "Ti ascolto" : "Di' «Ehi Roby»"}
    </p>
  );
}

function Status({ state, connected, showTimers }: { state: HomeState; connected: boolean; showTimers: boolean }) {
  const timers = state.timers.length;
  return (
    <div className="flex flex-wrap items-center gap-4">
      <Mic state={state} />
      {showTimers && timers > 0 && (
        <p className="flex items-center gap-2 text-2xl text-muted"><Timer aria-hidden weight="bold" className="size-7" /> {timers} timer</p>
      )}
      {!connected ? (
        <p className="flex items-center gap-2 text-2xl text-muted"><WarningCircle aria-hidden weight="bold" className="size-7" /> Roby non risponde</p>
      ) : !state.online && (
        <p className="flex items-center gap-2 text-2xl text-muted"><WifiSlash aria-hidden weight="bold" className="size-7" /> Senza internet</p>
      )}
    </div>
  );
}

function NoSignal() {
  return (
    <main className="crt flex h-[100dvh] flex-col justify-center gap-6 p-[calc(3rem+var(--overscan))]">
      <RobyTile expression="sleepy" className="size-32" />
      <h1 className="text-6xl font-semibold">Nessun segnale</h1>
      <p className="max-w-4xl text-3xl leading-snug text-muted">
        Sto aspettando Roby su questo apparecchio. Se non arriva, controlla che il servizio brain sia acceso.
      </p>
    </main>
  );
}
