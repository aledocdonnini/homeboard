"use client";

import { useState } from "react";
import { Plus } from "@phosphor-icons/react";
import { addDays, describe, zonedDate } from "@shared/recurrence";
import { useRows } from "@/lib/useRows";
import Big from "@/components/dash/Big";
import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import ReminderForm from "./ReminderForm";
import { dayLabel, hhmm, recurrenceOf, upcoming, type Reminder } from "./schedule";

export default function Reminders({ householdId, tz }: { householdId: string; tz: string }) {
  const { rows, error, reload } = useRows<Reminder>("reminders", householdId);
  const [editing, setEditing] = useState<Reminder | "new" | null>(null);
  const [now] = useState(() => new Date());
  const today = zonedDate(now, tz), tomorrow = addDays(today, 1);
  const { next, past } = upcoming(rows ?? [], now, tz);
  const first = next[0];

  // Righe raggruppate per giorno della prossima occorrenza.
  const days = [...new Set(next.map((u) => u.day))];

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 pt-6 pb-32 lg:max-w-2xl">
      <PageHeader title="Promemoria">
        <p className="flex items-end gap-3">
          <Big className="text-8xl">{first ? hhmm(first.reminder.at_time) : "--:--"}</Big>
          <span className="pb-2 text-xl text-muted">{first ? dayLabel(first.day, today, tomorrow).split(" ")[0]!.toLowerCase() : "niente in programma"}</span>
        </p>
        {first && <p className="text-2xl font-semibold">{first.reminder.title}</p>}
      </PageHeader>

      <Button onClick={() => setEditing("new")} className="self-start">
        <Plus aria-hidden weight="bold" className="size-5" /> Nuovo promemoria
      </Button>
      {error && <p role="alert" className="text-danger">Non riesco a leggere i promemoria: {error}</p>}

      {rows && next.length === 0 && (
        <EmptyState expression="sleepy" title="Nessun promemoria">
          Aggiungine uno: una cosa da fare a un&apos;ora precisa, anche ogni giorno o ogni settimana. Ti arriverà una notifica sul telefono.
        </EmptyState>
      )}

      {days.map((day) => (
        <section key={day} aria-labelledby={`d-${day}`} className="flex flex-col">
          <h2 id={`d-${day}`} className="text-base font-semibold text-muted">{dayLabel(day, today, tomorrow)}</h2>
          <ul>
            {next.filter((u) => u.day === day).map(({ reminder: r }) => (
              <li key={r.id} className="border-b border-line last:border-b-0">
                <button type="button" onClick={() => setEditing(r)} className="flex w-full items-baseline gap-4 py-4 text-left">
                  <span className="w-[5ch] shrink-0 text-4xl font-semibold tracking-[-0.04em]">{hhmm(r.at_time)}</span>
                  <span className="flex flex-col">
                    <span className="text-xl font-medium">{r.title}</span>
                    <span className="text-muted">{describe(recurrenceOf(r))}{r.note ? `. ${r.note}` : ""}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {past.length > 0 && (
        <section aria-labelledby="past" className="flex flex-col border-t-4 border-ink pt-4">
          <h2 id="past" className="text-base font-semibold text-muted">Già passati</h2>
          <ul>
            {past.slice(0, 5).map((r) => (
              <li key={r.id} className="border-b border-line last:border-b-0">
                <button type="button" onClick={() => setEditing(r)} className="w-full py-3 text-left text-lg text-muted">
                  {r.title}, {dayLabel(r.start_date, today, tomorrow).toLowerCase()} alle {hhmm(r.at_time)}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Nuovo promemoria" : "Promemoria"}>
        {editing !== null && (
          <ReminderForm key={editing === "new" ? "new" : editing.id} householdId={householdId} tz={tz} today={today}
            reminder={editing === "new" ? undefined : editing} onDone={() => { setEditing(null); void reload(); }} />
        )}
      </Dialog>
    </main>
  );
}
