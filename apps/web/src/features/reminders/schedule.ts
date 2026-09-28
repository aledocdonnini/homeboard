import { nextReminderAt, occurrencesBetween, zonedDate, type PlainDate, type Recurrence } from "@homeboard/core/recurrence";
import type { Tables } from "@/lib/database.types";

export type Reminder = Tables<"reminders">;
export const recurrenceOf = (r: { recurrence: unknown }) => (r.recurrence ?? null) as Recurrence | null;
export const hhmm = (time: string) => time.slice(0, 5);

export type Upcoming = { reminder: Reminder; at: Date; day: PlainDate };

/** Prossima occorrenza di ciascun promemoria, in ordine; quelli finiti (una volta, già passati) a parte. */
export function upcoming(rows: Reminder[], now: Date, tz: string): { next: Upcoming[]; past: Reminder[] } {
  const next: Upcoming[] = [];
  const past: Reminder[] = [];
  for (const r of rows) {
    const at = nextReminderAt(r.start_date, hhmm(r.at_time), recurrenceOf(r), now, tz);
    if (at) next.push({ reminder: r, at, day: zonedDate(at, tz) });
    else past.push(r);
  }
  return { next: next.sort((a, b) => +a.at - +b.at), past };
}

/** I promemoria di un giorno (per il cruscotto: "oggi"), in ordine di ora. */
export function onDay(rows: Reminder[], day: PlainDate) {
  return rows
    .filter((r) => occurrencesBetween(r.start_date, recurrenceOf(r), day, day).length > 0)
    .sort((a, b) => a.at_time.localeCompare(b.at_time));
}

/** "Oggi", "Domani", oppure "giovedì 2 ottobre". */
export function dayLabel(day: PlainDate, today: PlainDate, tomorrow: PlainDate) {
  if (day === today) return "Oggi";
  if (day === tomorrow) return "Domani";
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const s = new Date(y, m - 1, d).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
