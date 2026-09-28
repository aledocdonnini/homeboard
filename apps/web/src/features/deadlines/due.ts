import { daysBetween, nextOccurrence, type PlainDate, type Recurrence } from "@homeboard/core/recurrence";
import type { Tables } from "@/lib/database.types";

export type Deadline = Tables<"deadlines">;
export const recurrenceOf = (d: { recurrence: unknown }) => (d.recurrence ?? null) as Recurrence | null;

export const CATEGORIES = [
  { id: "bollette", label: "Bollette" },
  { id: "auto", label: "Auto" },
  { id: "assicurazioni", label: "Assicurazioni" },
  { id: "casa", label: "Casa" },
  { id: "abbonamenti", label: "Abbonamenti" },
  { id: "salute", label: "Salute" },
  { id: "altro", label: "Altro" },
] as const;
export const categoryLabel = (id: string) => CATEGORIES.find((c) => c.id === id)?.label ?? "Altro";

/** Anticipi proposti, in giorni: 0 = il giorno stesso. */
export const NOTIFY_CHOICES = [30, 14, 7, 3, 1, 0];
export const notifyLabel = (n: number) => (n === 0 ? "Il giorno stesso" : n === 1 ? "1 giorno prima" : `${n} giorni prima`);

export type OpenDeadline = { deadline: Deadline; daysLeft: number };

/** Scadenze da fare, dalla più vicina (le scadute in cima), con i giorni che mancano da oggi. */
export const open = (rows: Deadline[], today: PlainDate): OpenDeadline[] =>
  rows.filter((d) => !d.done_at)
    .map((d) => ({ deadline: d, daysLeft: daysBetween(today, d.due_date) }))
    .sort((a, b) => a.daysLeft - b.daysLeft);

/** Scadenza successiva a quella da segnare fatta (null se non si ripete). Contata dall'àncora: niente deriva. */
export const nextDue = (d: Deadline) => {
  const r = recurrenceOf(d);
  return r ? nextOccurrence(d.start_date, r, d.due_date, true) : null;
};

/** "tra 3 giorni", "oggi", "domani", "scaduta da 2 giorni". */
export function whenLabel(daysLeft: number) {
  if (daysLeft === 0) return "oggi";
  if (daysLeft === 1) return "domani";
  if (daysLeft < 0) return `scaduta da ${-daysLeft} ${daysLeft === -1 ? "giorno" : "giorni"}`;
  return `tra ${daysLeft} giorni`;
}

/** "gio 24 settembre", con l'anno solo se non è quello di `today`. */
export const shortDate = (day: PlainDate, today: PlainDate) => {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const year = day.slice(0, 4) === today.slice(0, 4) ? {} : { year: "numeric" as const };
  return new Date(y, m - 1, d).toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "long", ...year });
};

/** "giorno", "giorni", "giorno di ritardo", "giorni di ritardo". */
export const daysWord = (n: number) => (n < 0 ? (n === -1 ? "giorno di ritardo" : "giorni di ritardo") : n === 1 ? "giorno" : "giorni");
