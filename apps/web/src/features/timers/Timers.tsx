"use client";

import { useEffect, useState } from "react";
import { countdown, secondsLeft } from "@homeboard/core/timers";
import Big from "@/components/dash/Big";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import Section from "@/components/ui/Section";
import { useTimers } from "./useTimers";

const name = (t: { label: string | null }) => (t.label ? t.label[0]!.toUpperCase() + t.label.slice(1) : "Timer");

// I timer di casa: si mettono a voce a Roby ("timer pasta dieci minuti"), qui si guardano da lontano.
export default function Timers({ householdId }: { householdId: string }) {
  const { timers, error, piOnline } = useTimers(householdId);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  const list = timers ?? [];
  const first = list[0];

  return (
    <Section aside={<>
      <PageHeader title="Timer">
        <p className="flex items-end gap-3">
          <Big className={`text-8xl lg:text-[10rem] ${first?.status === "ringing" ? "text-accent-text" : ""}`}>
            {first ? countdown(secondsLeft(first.ends_at, now)) : "--:--"}
          </Big>
        </p>
        <p className="text-xl text-muted">
          {first ? (first.status === "ringing" ? `${name(first)}: sta suonando` : name(first)) : "nessun timer attivo"}
        </p>
      </PageHeader>
      <p className="text-muted">
        {piOnline === null ? "Nessun Roby abbinato: i timer si mettono a voce, a casa."
          : piOnline ? "Roby è acceso: i timer sono aggiornati."
          : "Roby non si sente da qualche minuto: quello che vedi potrebbe non essere aggiornato."}
      </p>
      {error && <p role="alert" className="text-danger">Non riesco a leggere i timer: {error}</p>}
    </>}>
      {timers && list.length === 0 && (
        <EmptyState expression="sleepy" title="Nessun timer">
          Dillo a Roby, a casa: &ldquo;timer pasta dieci minuti&rdquo;. Qui vedi quanto manca, anche da fuori.
        </EmptyState>
      )}
      {list.length > 0 && (
        <ul>
          {list.map((t) => (
            <li key={t.id} className="flex items-baseline gap-6 border-b border-line py-4 last:border-b-0">
              <span className={`w-[5ch] shrink-0 text-5xl font-semibold tracking-[-0.04em] ${t.status === "ringing" ? "text-accent-text" : ""}`}>
                {countdown(secondsLeft(t.ends_at, now))}
              </span>
              <span className="flex flex-col">
                <span className="text-xl font-medium">{name(t)}</span>
                <span className="text-muted">{t.status === "ringing" ? "Sta suonando: di' «basta» a Roby" : `di ${countdown(t.duration_s)}, finisce alle ${new Date(t.ends_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
