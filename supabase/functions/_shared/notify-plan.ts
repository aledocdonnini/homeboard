// Cosa notificare adesso: logica pura della funzione `notify` (test in notify-plan.test.ts).
// La funzione gira ogni minuto (pg_cron); ogni messaggio ha una chiave unica, e il registro delle notifiche
// (notification_log) garantisce che parta una volta sola anche se il giro si ripete.

import { addDays, nextReminderAt, zonedDate, type PlainDate, type Recurrence } from "./recurrence.ts";

export type ReminderRow = {
  id: string; household_id: string; title: string; note: string | null;
  start_date: PlainDate; at_time: string; recurrence: Recurrence | null; next_at: string;
};
export type DeadlineRow = { id: string; household_id: string; title: string; due_date: PlainDate; notify_days: number[] };

export type Message = {
  household_id: string; kind: "reminder" | "deadline"; item_id: string;
  /** Unica per occorrenza: evita doppioni se il giro si ripete. */
  key: string;
  title: string; body: string; url: string; tag: string;
};

/** Oltre questo ritardo un promemoria non si manda più (es. server fermo per ore): si passa al prossimo. */
export const LATE_LIMIT_MS = 60 * 60 * 1000;
/** Le scadenze si annunciano dalle 9 del mattino, ora di casa. */
export const DEADLINE_HOUR = "09:00";

const hhmm = (t: string) => t.slice(0, 5);
const localTime = (now: Date, tz: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);

/** Promemoria scaduti (next_at <= adesso): cosa mandare e il nuovo next_at di ciascuno. */
export function planReminders(rows: ReminderRow[], now: Date, tzOf: (hid: string) => string) {
  const messages: Message[] = [];
  const updates: { id: string; next_at: string | null }[] = [];
  for (const r of rows) {
    const due = new Date(r.next_at);
    if (due > now) continue;
    const tz = tzOf(r.household_id);
    if (+now - +due <= LATE_LIMIT_MS) {
      messages.push({
        household_id: r.household_id, kind: "reminder", item_id: r.id, key: r.next_at,
        title: r.title, body: r.note || `Promemoria delle ${hhmm(r.at_time)}`, url: "/promemoria", tag: `reminder-${r.id}`,
      });
    }
    const next = nextReminderAt(r.start_date, hhmm(r.at_time), r.recurrence, now, tz);
    updates.push({ id: r.id, next_at: next?.toISOString() ?? null });
  }
  return { messages, updates };
}

function deadlineBody(daysBefore: number, due: PlainDate) {
  if (daysBefore === 0) return "Scade oggi.";
  if (daysBefore === 1) return "Scade domani.";
  const [y, m, d] = due.split("-").map(Number) as [number, number, number];
  const when = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  return `Scade tra ${daysBefore} giorni, ${when}.`;
}

/** Scadenze da annunciare oggi: una per ogni anticipo che cade oggi, dalle 9 in poi. */
export function planDeadlines(rows: DeadlineRow[], now: Date, tzOf: (hid: string) => string): Message[] {
  const messages: Message[] = [];
  for (const d of rows) {
    const tz = tzOf(d.household_id);
    if (localTime(now, tz) < DEADLINE_HOUR) continue;
    const today = zonedDate(now, tz);
    for (const n of new Set(d.notify_days)) {
      if (addDays(d.due_date, -n) !== today) continue;
      messages.push({
        household_id: d.household_id, kind: "deadline", item_id: d.id, key: `${d.due_date}:${n}`,
        title: d.title, body: deadlineBody(n, d.due_date), url: "/scadenze", tag: `deadline-${d.id}`,
      });
    }
  }
  return messages;
}
