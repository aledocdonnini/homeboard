"use client";

import { useState } from "react";
import { weekday, type Recurrence } from "@shared/recurrence";
import { supabase } from "@/lib/supabase";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";
import RecurrencePicker, { type Preset } from "@/components/ui/RecurrencePicker";
import { CATEGORIES, NOTIFY_CHOICES, notifyLabel, recurrenceOf, type Deadline } from "./due";

const PRESETS: Preset[] = [
  { label: "Mai", value: null },
  { label: "Ogni mese", value: { freq: "month", interval: 1 } },
  { label: "Ogni 2 mesi", value: { freq: "month", interval: 2 } },
  { label: "Ogni anno", value: { freq: "year", interval: 1 } },
  { label: "Ogni 2 anni", value: { freq: "year", interval: 2 } },
];

// Crea o modifica una scadenza: data, ripetizione (mesi o anni) e con quanto anticipo avvisare.
export default function DeadlineForm({ householdId, today, deadline, onDone }: {
  householdId: string; today: string; deadline?: Deadline; onDone: () => void;
}) {
  const [title, setTitle] = useState(deadline?.title ?? "");
  const [category, setCategory] = useState(deadline?.category ?? "bollette");
  const [due, setDue] = useState(deadline?.due_date ?? today);
  const [recurrence, setRecurrence] = useState<Recurrence | null>(deadline ? recurrenceOf(deadline) : null);
  const [notify, setNotify] = useState<number[]>(deadline?.notify_days ?? [7, 0]);
  const [note, setNote] = useState(deadline?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    // Cambiare la data sposta anche l'àncora delle ricorrenze: le prossime si contano dalla nuova data.
    const row = { title: title.trim(), category, note: note.trim() || null, due_date: due, start_date: due, recurrence, notify_days: notify };
    const { error } = deadline
      ? await supabase.from("deadlines").update(due === deadline.due_date ? { ...row, start_date: deadline.start_date } : row).eq("id", deadline.id)
      : await supabase.from("deadlines").insert({ ...row, household_id: householdId });
    setBusy(false);
    if (error) setError(`Scadenza non salvata: ${error.message}`);
    else onDone();
  }

  async function remove() {
    setBusy(true);
    const { error } = await supabase.from("deadlines").update({ deleted_at: new Date().toISOString() }).eq("id", deadline!.id);
    setBusy(false);
    if (error) setError(`Scadenza non eliminata: ${error.message}`);
    else onDone();
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <Field id="d-title" label="Cosa scade" required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Bollo auto" />
      <div className="grid grid-cols-2 gap-3">
        <Field id="d-due" label="Scade il" type="date" required value={due} onChange={(e) => setDue(e.target.value)} />
        <div className="flex flex-col gap-2">
          <label htmlFor="d-cat" className="font-semibold">Tipo</label>
          <select id="d-cat" value={category} onChange={(e) => setCategory(e.target.value)}
            className="min-h-12 rounded-control border border-edge bg-surface px-3 text-lg">
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
      </div>
      <RecurrencePicker id="d-rec" value={recurrence} onChange={setRecurrence} presets={PRESETS} units={["month", "year"]} defaultWeekday={weekday(due)} />
      <fieldset className="flex flex-col gap-2">
        <legend className="pb-2 font-semibold">Avvisami</legend>
        <div className="flex flex-wrap gap-2">
          {NOTIFY_CHOICES.map((n) => {
            const on = notify.includes(n);
            return (
              <button key={n} type="button" aria-pressed={on}
                onClick={() => setNotify(on ? notify.filter((x) => x !== n) : [...notify, n].sort((a, b) => b - a))}
                className="min-h-11 rounded-control border border-edge bg-surface px-3 aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-paper">
                {notifyLabel(n)}
              </button>
            );
          })}
        </div>
        {notify.length === 0 && <p className="text-muted">Nessun avviso: la vedrai solo nell&apos;elenco e sulla TV.</p>}
      </fieldset>
      <div className="flex flex-col gap-2">
        <label htmlFor="d-note" className="font-semibold">Nota</label>
        <textarea id="d-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)}
          className="rounded-control border border-edge bg-surface px-4 py-3 text-lg" />
      </div>
      {error && <p role="alert" className="text-danger">{error}</p>}
      <div className="flex flex-wrap justify-between gap-3 pt-2">
        {deadline ? <Button variant="link" onClick={remove} disabled={busy}>Elimina</Button> : <span />}
        <div className="flex gap-3">
          <Button variant="quiet" onClick={onDone}>Annulla</Button>
          <Button type="submit" disabled={busy}>{deadline ? "Salva" : "Aggiungi"}</Button>
        </div>
      </div>
    </form>
  );
}
