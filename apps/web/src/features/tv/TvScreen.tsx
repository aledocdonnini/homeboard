"use client";

import { useEffect, useRef, useState } from "react";
import RobyTile from "@/components/ui/RobyTile";
import { isNight, nothingOnAir, summary } from "./broadcast";
import Cruscotto, { type DashData } from "./Cruscotto";
import { expressionFor } from "./expression";
import Monoscope from "./Monoscope";
import RobyChannel from "./RobyChannel";
import Snow from "./Snow";
import { say } from "./voice";

const CHANNELS = { 1: "In onda ora", 2: "Spesa", 3: "Promemoria", 4: "Scadenze", 5: "Monoscopio", 6: "Roby" } as const;
type Channel = keyof typeof CHANNELS;
/** Di notte un tasto riaccende la TV per un po', poi torna la fine delle trasmissioni. */
const WAKE_MS = 2 * 60_000;

export type Arrival = { text: string; at: number };

const localTime = (tz: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());

/**
 * La TV: sei canali sui sei tasti (1-6), OSD, neve al cambio, notte, annunci di Roby.
 * `night`: orari "HH:MM" della casa; `arrival`: una cosa appena arrivata (Roby sorpreso e la annuncia).
 */
export default function TvScreen({ data, tz, night, arrival, voiceUrl }: {
  data: DashData; tz: string; night?: { start: string; end: string } | null; arrival?: Arrival | null; voiceUrl?: string | null;
}) {
  const [channel, setChannel] = useState<Channel>(1);
  const [osdKey, setOsdKey] = useState(0);
  const [snow, setSnow] = useState(0);
  const [time, setTime] = useState(() => localTime(tz));
  const [awake, setAwake] = useState(false);
  const wake = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [fresh, setFresh] = useState<Arrival | null>(null);

  const sleeping = !!night && isNight(time, night.start, night.end) && !awake;

  useEffect(() => {
    // Taratura dell'overscan dal kiosk: /casa?overscan=6 (in % del lato corto, 0-20).
    const overscan = Number(new URLSearchParams(location.search).get("overscan") ?? NaN);
    if (overscan >= 0 && overscan <= 20) document.documentElement.style.setProperty("--overscan", `${overscan}vmin`);
    const clock = setInterval(() => setTime(localTime(tz)), 15_000);
    return () => clearInterval(clock);
  }, [tz]);

  useEffect(() => {
    // I sei tasti del televisore arrivano come tasti 1-6 (overlay gpio-key sul Raspberry).
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key) as Channel;
      if (!(n in CHANNELS)) return;
      setAwake(true);
      clearTimeout(wake.current);
      wake.current = setTimeout(() => setAwake(false), WAKE_MS);
      setChannel((prev) => {
        if (prev !== n) setSnow((k) => k + 1);
        return n;
      });
      setOsdKey((k) => k + 1);
    };
    addEventListener("keydown", onKey);
    return () => {
      removeEventListener("keydown", onKey);
      clearTimeout(wake.current);
    };
  }, []);

  useEffect(() => {
    // Una cosa nuova: Roby sorpreso per qualche secondo e un annuncio a voce (mai di notte).
    if (!arrival || sleeping) return;
    const show = setTimeout(() => setFresh(arrival), 0);
    const hide = setTimeout(() => setFresh(null), 6000);
    void say(arrival.text, voiceUrl);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrival]);

  const mood = { night: sleeping, justAdded: !!fresh, daysLeft: data.deadlines.map((d) => d.daysLeft), shoppingCount: data.shopping.todo.length };
  const hour = Number(time.slice(0, 2));

  return (
    <div className="crt min-h-[100dvh] overflow-hidden">
      {sleeping ? (
        <Monoscope night resume={night!.end} />
      ) : channel === 5 || (channel === 1 && nothingOnAir(data)) ? (
        <Monoscope caption={channel === 5 ? "Canale 5" : "Niente in programma"} />
      ) : channel === 6 ? (
        <RobyChannel expression={expressionFor(mood)} text={summary(data, hour)} voiceUrl={voiceUrl} speakKey={osdKey} />
      ) : (
        <Cruscotto data={data} tv channel={channel} surprised={!!fresh} />
      )}

      {fresh && (
        <div role="status" className="fixed bottom-[calc(2rem+var(--overscan))] left-[calc(2.5rem+var(--overscan))] z-50 flex items-center gap-5 rounded-module bg-accent p-5 pr-8 text-on-accent">
          <RobyTile expression="surprised" className="size-24" />
          <p className="text-4xl font-semibold">{fresh.text}</p>
        </div>
      )}

      {/* OSD del canale nell'angolo: compare al cambio e sparisce. */}
      <p key={osdKey} aria-live="polite"
        className={`fixed top-[calc(2rem+var(--overscan))] right-[calc(2.5rem+var(--overscan))] z-50 [font-stretch:75%] text-7xl font-semibold text-accent-text ${osdKey ? "motion-safe:animate-[osd_2.5s_steps(1)_forwards]" : "opacity-0"}`}>
        <span className="sr-only">Canale </span>{channel}<span className="sr-only">, {CHANNELS[channel]}</span>
      </p>
      <Snow trigger={snow} />
    </div>
  );
}
