"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import Big from "@/components/dash/Big";
import Clock from "@/components/dash/Clock";
import DotGrid from "@/components/dash/DotGrid";
import Module from "@/components/dash/Module";
import MonthDots from "@/components/dash/MonthDots";
import RobyPanel from "@/components/dash/RobyPanel";
import TickRuler from "@/components/dash/TickRuler";
import RobyTile from "@/components/ui/RobyTile";
import { expressionFor } from "./expression";

export type DashDeadline = { title: string; due: Date; daysLeft: number };
export type DashReminder = { time: string; title: string; note?: string };
export type DashData = { deadlines: DashDeadline[]; reminders: DashReminder[]; shopping: { todo: string[]; inCart: string[] } };

// Canali della TV: 1 cruscotto, 2-4 un dettaglio a schermo intero. 5 (monoscopio) e 6 (Roby) arrivano con la fase 7.
const CHANNELS = { 1: "In onda ora", 2: "Spesa", 3: "Promemoria", 4: "Scadenze" } as const;
type Channel = keyof typeof CHANNELS;

const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("it-IT", o);
const giorni = (n: number) => (n === 1 ? "giorno" : "giorni");
const two = (n: number) => String(n).padStart(2, "0");

/**
 * Il cruscotto. `tv`: la vista del televisore (tasti 1-4 per i canali, OSD, tutto lo schermo).
 * Senza `tv` è la home della PWA: stesso cruscotto, con la barra in basso e i moduli che portano alle sezioni.
 */
export default function Cruscotto({ data, tv = false }: { data: DashData; tv?: boolean }) {
  const [channel, setChannel] = useState<Channel>(1);
  const [osdKey, setOsdKey] = useState(0); // cambia a ogni cambio canale: riparte l'animazione dell'OSD
  const [today] = useState(() => new Date()); // solo client: le pagine lo montano senza SSR

  useEffect(() => {
    if (!tv) return;
    // Taratura dell'overscan dal kiosk: /tv?overscan=6 (in % del lato corto, 0-20).
    const overscan = Number(new URLSearchParams(location.search).get("overscan") ?? NaN);
    if (overscan >= 0 && overscan <= 20) document.documentElement.style.setProperty("--overscan", `${overscan}vmin`);
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
  }, [tv]);

  const [next, ...later] = data.deadlines;
  const { todo, inCart } = data.shopping;
  const mood = { night: false, justAdded: false, daysLeft: data.deadlines.map((d) => d.daysLeft), shoppingCount: todo.length };
  const says = next && next.daysLeft <= 7
    ? `${next.title}: scade tra ${next.daysLeft} ${giorni(next.daysLeft)}.`
    : todo.length ? `${todo.length === 1 ? "C'è 1 cosa" : `Ci sono ${todo.length} cose`} da prendere.` : "La lista della spesa è vuota.";
  const marked = data.deadlines.filter((d) => d.due.getMonth() === today.getMonth()).map((d) => d.due.getDate());
  const soon = data.deadlines.filter((d) => d.daysLeft <= 30).length;
  const shown = tv ? channel : 1;
  // Nella PWA i moduli portano alla sezione; sulla TV no.
  const to = (href: string, node: ReactNode) => (tv ? node : <Link href={href} className="block rounded-module active:translate-y-px">{node}</Link>);

  return (
    <div className="crt min-h-[100dvh]">
      {/* ——— Schermi grandi: TV 1920×1280, desktop ——— */}
      <main className={`hidden grid-cols-12 gap-10 p-[calc(2.5rem+var(--overscan))] lg:grid ${tv ? "h-[100dvh]" : "h-[calc(100dvh-5.5rem)]"}`}>
        {shown === 1 && (
          <>
            <div className="col-span-3 flex flex-col justify-between">
              <Clock className="text-[clamp(7rem,12vw,14rem)]" />
              <DateBlock today={today} />
            </div>

            <div className="col-span-6 flex flex-col">
              <p className="pb-3 text-xl text-muted">In onda ora</p>
              {next ? (
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
              ) : (
                <section aria-label="Spesa" className="flex flex-col gap-6 border-t-4 border-ink pt-6">
                  <div className="flex items-end gap-6">
                    <Big className="text-[clamp(8rem,13vw,13rem)]">{two(todo.length)}</Big>
                    <p className="pb-3 text-3xl text-muted">da prendere</p>
                  </div>
                  <p className="text-3xl leading-snug">{todo.slice(0, 6).join(", ") || "La lista è vuota."}</p>
                </section>
              )}
              <section aria-label="Promemoria di oggi" className="mt-8 flex flex-col border-t border-line">
                {data.reminders.length
                  ? data.reminders.slice(0, 2).map((r) => <ReminderRow key={r.title} r={r} size="md" />)
                  : <p className="py-5 text-2xl text-muted">Nessun promemoria per oggi.</p>}
              </section>
              {next && (
                <section aria-label="Spesa" className="mt-auto flex items-center gap-8 border-t border-line pt-6">
                  <Big className="text-7xl">{two(todo.length)}</Big>
                  <p className="text-2xl text-muted">da prendere</p>
                  <DotGrid filled={todo.length} total={todo.length + inCart.length} cols={Math.max(todo.length + inCart.length, 1)} className="ml-auto w-64" />
                </section>
              )}
            </div>

            <div className="col-span-3 flex flex-col gap-6">
              <RobyPanel expression={expressionFor(mood)} says={says} className="flex-1" />
              <div className="grid grid-cols-2 gap-4">
                {to("/spesa", <Module label="Spesa"><Big className="text-6xl">{two(todo.length)}</Big></Module>)}
                {to("/scadenze", <Module label="Scadenze in 30 giorni"><Big className="text-6xl">{two(soon)}</Big></Module>)}
              </div>
            </div>
          </>
        )}

        {shown === 2 && (
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

        {shown === 3 && (
          <>
            <div className="col-span-3 flex flex-col justify-between">
              <Clock className="text-[clamp(7rem,12vw,14rem)]" />
              <DateBlock today={today} />
            </div>
            <section aria-label="Promemoria" className="col-span-9 flex flex-col self-center border-t-4 border-ink">
              {data.reminders.length
                ? data.reminders.map((r) => <ReminderRow key={r.title} r={r} size="lg" />)
                : <p className="py-8 text-5xl text-muted">Nessun promemoria.</p>}
            </section>
          </>
        )}

        {shown === 4 && (
          <>
            <div className="col-span-4 flex flex-col justify-between">
              <DateBlock today={today} />
              <MonthDots today={today} marked={marked} className="w-full max-w-sm" />
            </div>
            <section aria-label="Scadenze" className="col-span-8 flex flex-col self-center">
              {data.deadlines.length === 0 && <p className="border-t-4 border-ink py-8 text-5xl text-muted">Nessuna scadenza.</p>}
              {data.deadlines.map((d, i) => (
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

        {tv && (
          // OSD del canale nell'angolo: compare al cambio e sparisce.
          <p key={osdKey} aria-live="polite"
            className="fixed top-[calc(2rem+var(--overscan))] right-[calc(2.5rem+var(--overscan))] z-50 [font-stretch:75%] font-semibold text-7xl text-accent-text motion-safe:animate-[osd_2.5s_steps(1)_forwards]">
            <span className="sr-only">Canale </span>{channel}<span className="sr-only">, {CHANNELS[channel]}</span>
          </p>
        )}
      </main>

      {/* ——— Telefono e schermi medi: gli stessi moduli, in colonna per rilevanza ——— */}
      <main className={`mx-auto flex w-full max-w-md flex-col gap-4 px-4 pt-6 md:max-w-3xl lg:hidden ${tv ? "pb-10" : "pb-32"}`}>
        <section aria-label="Oggi" className="flex flex-col gap-4 pb-2">
          <div className="flex items-end justify-between">
            <div>
              <h1 className="sr-only">Oggi</h1>
              <Big className="text-[7.5rem]">{today.getDate()}</Big>
              <p className="text-3xl font-semibold capitalize">{fmt(today, { month: "long" })}</p>
              <p className="text-3xl text-muted">{today.getFullYear()}</p>
            </div>
            <p className="pb-10 text-3xl font-semibold text-muted capitalize">{fmt(today, { weekday: "short" })}</p>
          </div>
          <MonthDots today={today} marked={marked} />
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          {next && to("/scadenze", (
            <Module label="In primo piano">
              <div className="flex items-end gap-3">
                <Big className="text-7xl text-accent-text">{two(next.daysLeft)}</Big>
                <p className="pb-1 text-xl text-muted">{giorni(next.daysLeft)}</p>
              </div>
              <p className="text-2xl font-semibold">{next.title}</p>
              <TickRuler daysLeft={next.daysLeft} className="h-8" />
            </Module>
          ))}
          {to("/spesa", (
            <Module label="Spesa" className="h-full">
              <div className="flex items-end gap-3">
                <Big className="text-7xl">{two(todo.length)}</Big>
                <p className="pb-1 text-xl text-muted">da prendere</p>
              </div>
              {todo.length + inCart.length > 0
                ? <DotGrid filled={todo.length} total={todo.length + inCart.length} cols={10} className="mt-auto" />
                : <p className="text-muted">La lista è vuota.</p>}
            </Module>
          ))}
        </div>

        {to("/promemoria", (
          <Module label="Promemoria">
            {data.reminders.length
              ? data.reminders.slice(0, 2).map((r) => <ReminderRow key={r.title} r={r} size="sm" />)
              : <p className="text-lg text-muted">Nessun promemoria per oggi.</p>}
          </Module>
        ))}

        {later.length > 0 && to("/scadenze", (
          <Module label="Poi">
            {later.map((d) => (
              <p key={d.title} className="flex items-baseline justify-between gap-4 text-lg">
                {d.title}<span className="font-semibold">{d.daysLeft} {giorni(d.daysLeft)}</span>
              </p>
            ))}
          </Module>
        ))}

        <Module tone="accent" className="flex-row items-center gap-4">
          <RobyTile expression={expressionFor(mood)} className="size-16" />
          <p className="text-xl font-medium">{says}</p>
        </Module>
      </main>
    </div>
  );
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

function ReminderRow({ r, size }: { r: DashReminder; size: "sm" | "md" | "lg" }) {
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
