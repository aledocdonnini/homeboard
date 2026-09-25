"use client";

import { useEffect, useState } from "react";
import Clock from "@/components/dash/Clock";
import DotGrid from "@/components/dash/DotGrid";
import Module from "@/components/dash/Module";
import MonthDots from "@/components/dash/MonthDots";
import RobyPanel from "@/components/dash/RobyPanel";
import TickRuler from "@/components/dash/TickRuler";
import RobyTile from "@/components/ui/RobyTile";
import { expressionFor } from "./expression";
import { sample } from "./sample";

// Canali della TV: 1 cruscotto, 2-4 un dettaglio a schermo intero. 5 (monoscopio) e 6 (Roby) arrivano con la fase 7.
const CHANNELS = { 1: "In onda ora", 2: "Spesa", 3: "Promemoria", 4: "Scadenze" } as const;
type Channel = keyof typeof CHANNELS;

const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("it-IT", o);
const giorni = (n: number) => (n === 1 ? "giorno" : "giorni");
const two = (n: number) => String(n).padStart(2, "0");

export default function Cruscotto() {
  const [channel, setChannel] = useState<Channel>(1);
  const [osdKey, setOsdKey] = useState(0); // cambia a ogni cambio canale: riparte l'animazione dell'OSD
  const [today] = useState(() => new Date()); // solo client: vedi app/cruscotto/page.tsx

  useEffect(() => {
    // I sei tasti del televisore arrivano come tasti 1-6 (overlay gpio-key sul Raspberry).
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n in CHANNELS) {
        setChannel(n as Channel);
        setOsdKey((k) => k + 1);
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  const [next, ...later] = sample.deadlines;
  const { todo, inCart } = sample.shopping;
  const mood = { night: false, justAdded: false, daysLeft: sample.deadlines.map((d) => d.daysLeft), shoppingCount: todo.length };
  const says = next && next.daysLeft <= 7
    ? `${next.title}: scade tra ${next.daysLeft} ${giorni(next.daysLeft)}.`
    : `Ci sono ${todo.length} cose da prendere.`;
  const marked = sample.deadlines.filter((d) => d.due.getMonth() === today.getMonth()).map((d) => d.due.getDate());
  const soon = sample.deadlines.filter((d) => d.daysLeft <= 30).length;

  return (
    <div className="crt min-h-[100dvh]">
      {/* ——— Schermi grandi: TV 1920×1280, desktop ——— */}
      <main className="hidden h-[100dvh] grid-cols-12 gap-10 p-10 lg:grid">
        {channel === 1 && (
          <>
            <div className="col-span-3 flex flex-col justify-between">
              <Clock className="text-[clamp(7rem,12vw,14rem)]" />
              <DateBlock today={today} />
            </div>

            <div className="col-span-6 flex flex-col">
              <p className="pb-3 text-xl text-muted">In onda ora</p>
              {next && (
                <section aria-label="Prossima scadenza" className="flex flex-col gap-6 border-t-4 border-ink pt-6">
                  <div className="flex items-end gap-6">
                    <Big className="text-[clamp(8rem,13vw,13rem)] text-accent-text">{two(next.daysLeft)}</Big>
                    <div className="flex flex-col gap-1 pb-3">
                      <p className="text-3xl text-muted">{giorni(next.daysLeft)}</p>
                      <h2 className="text-5xl font-semibold tracking-tight">{next.title}</h2>
                      <p className="text-2xl text-muted">scade {fmt(next.due, { weekday: "long", day: "numeric", month: "long" })}</p>
                    </div>
                  </div>
                  <TickRuler daysLeft={next.daysLeft} />
                </section>
              )}
              <section aria-label="Promemoria di oggi" className="mt-8 flex flex-col border-t border-line">
                {sample.reminders.slice(0, 2).map((r) => <ReminderRow key={r.title} r={r} size="md" />)}
              </section>
              <section aria-label="Spesa" className="mt-auto flex items-center gap-8 border-t border-line pt-6">
                <Big className="text-7xl">{two(todo.length)}</Big>
                <p className="text-2xl text-muted">da prendere</p>
                <DotGrid filled={todo.length} total={todo.length + inCart.length} cols={todo.length + inCart.length} className="ml-auto w-64" />
              </section>
            </div>

            <div className="col-span-3 flex flex-col gap-6">
              <RobyPanel expression={expressionFor(mood)} says={says} className="flex-1" />
              <div className="grid grid-cols-2 gap-4">
                <Module label="Spesa"><Big className="text-6xl">{two(todo.length)}</Big></Module>
                <Module label="Scadenze in 30 giorni"><Big className="text-6xl">{two(soon)}</Big></Module>
              </div>
            </div>
          </>
        )}

        {channel === 2 && (
          <>
            <div className="col-span-5 flex flex-col justify-between">
              <div>
                <Big className="text-[clamp(10rem,18vw,18rem)]">{two(todo.length)}</Big>
                <p className="text-4xl text-muted">da prendere, {inCart.length} nel carrello</p>
              </div>
              <DotGrid filled={todo.length} total={todo.length + inCart.length} cols={7} className="w-full max-w-md" />
            </div>
            <ul className="col-span-7 flex flex-col self-center border-t-4 border-ink">
              {todo.map((t) => <li key={t} className="border-b border-line py-5 text-6xl font-semibold tracking-tight">{t}</li>)}
              {inCart.map((t) => <li key={t} className="border-b border-line py-5 text-6xl text-muted line-through">{t}</li>)}
            </ul>
          </>
        )}

        {channel === 3 && (
          <>
            <div className="col-span-3 flex flex-col justify-between">
              <Clock className="text-[clamp(7rem,12vw,14rem)]" />
              <DateBlock today={today} />
            </div>
            <section aria-label="Promemoria" className="col-span-9 flex flex-col self-center border-t-4 border-ink">
              {sample.reminders.map((r) => <ReminderRow key={r.title} r={r} size="lg" />)}
            </section>
          </>
        )}

        {channel === 4 && (
          <>
            <div className="col-span-4 flex flex-col justify-between">
              <DateBlock today={today} />
              <MonthDots today={today} marked={marked} className="w-full max-w-sm" />
            </div>
            <section aria-label="Scadenze" className="col-span-8 flex flex-col self-center">
              {sample.deadlines.map((d, i) => (
                <div key={d.title} className={`flex items-start gap-8 py-6 ${i === 0 ? "border-t-4 border-ink" : "border-t border-line"}`}>
                  <Big className={`w-[2.2ch] text-[9rem] ${i === 0 ? "text-accent-text" : ""}`}>{two(d.daysLeft)}</Big>
                  <div className="flex flex-col gap-1 pt-4">
                    <h2 className="text-5xl font-semibold tracking-tight">{d.title}</h2>
                    <p className="text-2xl text-muted">{giorni(d.daysLeft)}, scade {fmt(d.due, { weekday: "long", day: "numeric", month: "long" })}</p>
                  </div>
                </div>
              ))}
            </section>
          </>
        )}

        {/* OSD del canale nell'angolo: compare al cambio e sparisce. */}
        <p key={osdKey} aria-live="polite"
          className="fixed top-8 right-10 z-50 font-dots text-6xl font-bold text-accent-text motion-safe:animate-[osd_2.5s_steps(1)_forwards]">
          <span className="sr-only">Canale </span>{channel}<span className="sr-only">, {CHANNELS[channel]}</span>
        </p>
      </main>

      {/* ——— Telefono e schermi medi: gli stessi moduli, in colonna per rilevanza ——— */}
      <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pt-6 pb-10 md:max-w-3xl lg:hidden">
        <section aria-label="Oggi" className="flex flex-col gap-4 pb-2">
          <div className="flex items-end justify-between">
            <div>
              <Big className="text-[7.5rem]">{today.getDate()}</Big>
              <p className="text-3xl font-semibold capitalize">{fmt(today, { month: "long" })}</p>
              <p className="text-3xl text-muted">{today.getFullYear()}</p>
            </div>
            <p className="pb-10 text-3xl font-semibold text-muted capitalize">{fmt(today, { weekday: "short" })}</p>
          </div>
          <MonthDots today={today} marked={marked} />
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          {next && (
            <Module label="In primo piano">
              <div className="flex items-end gap-3">
                <Big className="text-7xl text-accent-text">{two(next.daysLeft)}</Big>
                <p className="pb-1 text-xl text-muted">{giorni(next.daysLeft)}</p>
              </div>
              <p className="text-2xl font-semibold">{next.title}</p>
              <TickRuler daysLeft={next.daysLeft} className="h-8" />
            </Module>
          )}
          <Module label="Spesa">
            <div className="flex items-end gap-3">
              <Big className="text-7xl">{two(todo.length)}</Big>
              <p className="pb-1 text-xl text-muted">da prendere</p>
            </div>
            <DotGrid filled={todo.length} total={todo.length + inCart.length} cols={10} className="mt-auto" />
          </Module>
        </div>

        <Module label="Promemoria">
          {sample.reminders.slice(0, 2).map((r) => <ReminderRow key={r.title} r={r} size="sm" />)}
        </Module>

        {later.length > 0 && (
          <Module label="Poi">
            {later.map((d) => (
              <p key={d.title} className="flex items-baseline justify-between gap-4 text-lg">
                {d.title}<span className="font-semibold">{d.daysLeft} {giorni(d.daysLeft)}</span>
              </p>
            ))}
          </Module>
        )}

        <Module tone="accent" className="flex-row items-center gap-4">
          <RobyTile expression={expressionFor(mood)} className="size-16" />
          <p className="text-xl font-medium">{says}</p>
        </Module>
      </main>
    </div>
  );
}

function Big({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`block leading-[0.82] font-semibold tracking-[-0.05em] ${className}`}>{children}</span>;
}

function DateBlock({ today }: { today: Date }) {
  return (
    <div className="flex items-end gap-5">
      <Big className="text-8xl">{two(today.getDate())}</Big>
      <div className="pb-1 text-3xl leading-tight capitalize">
        <p className="font-semibold">{fmt(today, { month: "long" })}</p>
        <p className="text-muted">{fmt(today, { weekday: "long" })}</p>
      </div>
    </div>
  );
}

function ReminderRow({ r, size }: { r: { time: string; title: string; note?: string }; size: "sm" | "md" | "lg" }) {
  const t = { sm: "text-4xl w-[5ch]", md: "text-6xl w-[5ch]", lg: "text-8xl w-[5ch]" }[size];
  const h = { sm: "text-lg", md: "text-3xl", lg: "text-5xl" }[size];
  return (
    <div className={`flex items-baseline gap-5 ${size === "sm" ? "py-1" : "border-b border-line py-5"}`}>
      <span className={`shrink-0 font-semibold tracking-[-0.04em] ${t}`}>{r.time}</span>
      <span className="flex flex-col">
        <span className={`font-medium ${h}`}>{r.title}</span>
        {r.note && <span className={`text-muted ${size === "sm" ? "text-sm" : "text-2xl"}`}>{r.note}</span>}
      </span>
    </div>
  );
}
