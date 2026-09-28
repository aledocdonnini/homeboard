"use client";

import { useEffect, useRef } from "react";
import { Microphone, MicrophoneSlash, Timer, WifiSlash, WarningCircle } from "@phosphor-icons/react";
import type { RobyFaceElement } from "roby-face";
import type { HomeState } from "@homeboard/core/protocol";
import RobyTile from "@/components/ui/RobyTile";
import Station from "./Station";
import { useBrain } from "./useBrain";

// La postazione di casa, sul Pi dentro la Crezar (1920×1280, 3:2). Solo vocale: lo schermo mostra e basta.
// Il layout è Station (lo stesso della PWA sul computer); qui tutto arriva da brain: la pagina non scrive niente.
export default function HomeView() {
  const face = useRef<RobyFaceElement>(null);
  const { state, connected } = useBrain((level) => face.current?.setSpeechLevel(level));

  useEffect(() => {
    // Taratura dell'overscan dal kiosk: /casa?overscan=6 (in % del lato corto, 0-20).
    const overscan = Number(new URLSearchParams(location.search).get("overscan") ?? NaN);
    if (overscan >= 0 && overscan <= 20) document.documentElement.style.setProperty("--overscan", `${overscan}vmin`);
  }, []);

  if (!state) return <NoSignal />;
  return (
    <Station state={state} face={face}
      footer={(panel) => panel.kind === "night" ? <Mic state={state} />
        : <Status state={state} connected={connected} showTimers={panel.kind !== "timers" && panel.kind !== "ringing"} />} />
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
