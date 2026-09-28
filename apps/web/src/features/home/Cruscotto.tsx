"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import Big from "@/components/dash/Big";
import DotGrid from "@/components/dash/DotGrid";
import Module from "@/components/dash/Module";
import MonthDots from "@/components/dash/MonthDots";
import TickRuler from "@/components/dash/TickRuler";
import RobyTile from "@/components/ui/RobyTile";
import { expressionFor } from "./expression";

export type DashDeadline = { title: string; due: Date; daysLeft: number };
export type DashReminder = { time: string; title: string; note?: string };
export type DashData = { deadlines: DashDeadline[]; reminders: DashReminder[]; shopping: { todo: string[]; inCart: string[] } };


const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("it-IT", o);
// I giorni possono essere negativi (scadenza passata): numero in positivo e "di ritardo" nell'etichetta.
const giorni = (n: number) => (n < 0 ? (n === -1 ? "giorno di ritardo" : "giorni di ritardo") : n === 1 ? "giorno" : "giorni");
const two = (n: number) => String(Math.abs(n)).padStart(2, "0");
const when = (n: number) => (n < 0 ? `scaduta da ${-n} ${n === -1 ? "giorno" : "giorni"}` : n === 0 ? "scade oggi" : `scade tra ${n} ${n === 1 ? "giorno" : "giorni"}`);

/** La home della PWA sul telefono: il cruscotto della casa, con i moduli che portano alle sezioni. */
export default function Cruscotto({ data, ask }: { data: DashData; ask?: ReactNode }) {
  const [today] = useState(() => new Date()); // solo client: le pagine lo montano senza SSR

  const [next, ...later] = data.deadlines;
  const { todo, inCart } = data.shopping;
  const mood = { night: false, justAdded: false, daysLeft: data.deadlines.map((d) => d.daysLeft), shoppingCount: todo.length };
  const says = next && next.daysLeft <= 7
    ? `${next.title}: ${when(next.daysLeft)}.`
    : todo.length ? `${todo.length === 1 ? "C'è 1 cosa" : `Ci sono ${todo.length} cose`} da prendere.` : "La lista della spesa è vuota.";
  const marked = data.deadlines.filter((d) => d.due.getMonth() === today.getMonth()).map((d) => d.due.getDate());
  const to = (href: string, node: ReactNode) => <Link href={href} className="block rounded-module active:translate-y-px">{node}</Link>;

  return (
    <div className="min-h-[100dvh]">
      {/* ——— Telefono e schermi medi: gli stessi moduli, in colonna per rilevanza ——— */}
      <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pt-6 pb-32 md:max-w-3xl">
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

        {ask}

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
                {d.title}<span className="font-semibold">{Math.abs(d.daysLeft)} {giorni(d.daysLeft)}</span>
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
