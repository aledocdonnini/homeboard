"use client";

import { useState } from "react";
import { nextReminderAt, weekday, type Recurrence } from "@homeboard/core/recurrence";
import { supabase } from "@/lib/supabase";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";
import RecurrencePicker, { type Preset } from "@/components/ui/RecurrencePicker";
import { hhmm, recurrenceOf, type Reminder } from "./schedule";

const PRESETS: Preset[] = [
  { label: "Mai", value: null },
  { label: "Ogni giorno", value: { freq: "day", interval: 1 } },
  { label: "Ogni settimana", value: { freq: "week", interval: 1 } },
  { label: "Ogni mese", value: { freq: "month", interval: 1 } },
  { label: "Ogni anno", value: { freq: "year", interval: 1 } },
];

// Crea o modifica un promemoria. Salva anche next_at, il prossimo istante da notificare (fase 6).
export default function ReminderForm({ householdId, tz, today, reminder, onDone }: {
  householdId: string; tz: string; today: string; reminder?: Reminder; onDone: () => void;
}) {
  const [title, setTitle] = useState(reminder?.title ?? "");
  const [date, setDate] = useState(reminder?.start_date ?? today);
  const [time, setTime] = useState(reminder ? hhmm(reminder.at_time) : "09:00");
  const [recurrence, setRecurrence] = useState<Recurrence | null>(reminder ? recurrenceOf(reminder) : null);
  const [note, setNote] = useState(reminder?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const row = {
      title: title.trim(), note: note.trim() || null, start_date: date, at_time: time, recurrence,
      next_at: nextReminderAt(date, time, recurrence, new Date(), tz)?.toISOString() ?? null,
    };
    const { error } = reminder
      ? await supabase.from("reminders").update(row).eq("id", reminder.id)
      : await supabase.from("reminders").insert({ ...row, household_id: householdId });
    setBusy(false);
    if (error) setError(`Promemoria non salvato: ${error.message}`);
    else onDone();
  }

  async function remove() {
    setBusy(true);
    const { error } = await supabase.from("reminders").update({ deleted_at: new Date().toISOString() }).eq("id", reminder!.id);
    setBusy(false);
    if (error) setError(`Promemoria non eliminato: ${error.message}`);
    else onDone();
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <Field id="r-title" label="Cosa" required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Portare fuori la plastica" />
      <div className="grid grid-cols-2 gap-3">
        <Field id="r-date" label={recurrence ? "Dal" : "Il"} type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        <Field id="r-time" label="Alle" type="time" required value={time} onChange={(e) => setTime(e.target.value)} />
      </div>
      <RecurrencePicker id="r-rec" value={recurrence} onChange={setRecurrence} presets={PRESETS}
        units={["day", "week", "month", "year"]} defaultWeekday={weekday(date)} />
      <div className="flex flex-col gap-2">
        <label htmlFor="r-note" className="font-semibold">Nota</label>
        <textarea id="r-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)}
          className="rounded-control border border-edge bg-surface px-4 py-3 text-lg" />
      </div>
      {error && <p role="alert" className="text-danger">{error}</p>}
      <div className="flex flex-wrap justify-between gap-3 pt-2">
        {reminder ? <Button variant="link" onClick={remove} disabled={busy}>Elimina</Button> : <span />}
        <div className="flex gap-3">
          <Button variant="quiet" onClick={onDone}>Annulla</Button>
          <Button type="submit" disabled={busy}>{reminder ? "Salva" : "Aggiungi"}</Button>
        </div>
      </div>
    </form>
  );
}
