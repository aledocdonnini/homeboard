// Gli intenti: cosa si può chiedere a Roby. Lo stesso schema valida le regole e il modello linguistico.

import { z } from "zod";

const Recurrence = z.object({
  freq: z.enum(["day", "week", "month", "year"]),
  interval: z.int().min(1).max(99),
  byWeekday: z.array(z.int().min(0).max(6)).optional(),
});
const PlainDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
/** Nome libero dell'utente ("pasta", "bolletta della luce"): testo, non id. */
const Name = z.string().trim().min(1).max(120);

export const Intent = z.discriminatedUnion("type", [
  z.object({ type: z.literal("shopping.add"), items: z.array(Name).min(1).max(30) }),
  z.object({ type: z.literal("shopping.remove"), items: z.array(Name).min(1).max(30) }),
  z.object({ type: z.literal("shopping.list") }),
  z.object({ type: z.literal("shopping.clear") }),
  z.object({ type: z.literal("timer.start"), seconds: z.int().min(1).max(86_400), label: Name.optional() }),
  z.object({ type: z.literal("timer.query"), label: Name.optional() }),
  z.object({ type: z.literal("timer.stop"), label: Name.optional() }),
  z.object({ type: z.literal("reminder.create"), title: Name, date: PlainDate, time: Time, recurrence: Recurrence.optional() }),
  z.object({ type: z.literal("deadline.query"), title: Name.optional() }),
  z.object({ type: z.literal("deadline.complete"), title: Name }),
  z.object({ type: z.literal("note.save"), body: z.string().trim().min(1).max(4000) }),
  z.object({ type: z.literal("note.ask"), question: Name }),
  z.object({ type: z.literal("confirm") }),
  z.object({ type: z.literal("cancel") }),
  /** Cambiare vista sullo schermo ("mostrami i promemoria"): la TV e il computer mostrano quella parte al centro. */
  z.object({ type: z.literal("show"), view: z.enum(["today", "shopping", "timers", "reminders", "deadlines", "notes", "settings"]) }),
  /** Due chiacchiere: saluti, "come stai", "grazie", l'ora, la data, "chi sei", "cosa sai fare". */
  z.object({ type: z.literal("smalltalk"), topic: z.enum(["hello", "how", "thanks", "time", "date", "who", "help"]) }),
  z.object({ type: z.literal("unknown"), text: z.string() }),
]);
export type Intent = z.infer<typeof Intent>;
export type IntentType = Intent["type"];

/** Azioni che chiedono conferma a voce prima di partire ("svuota la lista" → "Confermi?"). */
export const DESTRUCTIVE: ReadonlySet<IntentType> = new Set(["shopping.clear"]);

/**
 * Contesto della frase.
 * - now, timezone: per date e orari relativi ("domani alle otto") nel fuso della casa.
 * - timers, deadlines: i nomi in corso, per le frasi ambigue ("quanto manca alla pasta?" è un timer se
 *   c'è un timer "pasta"; "ho fatto la revisione" chiude la scadenza se esiste, altrimenti è una nota).
 * - bareIsShopping: una frase senza verbo ("latte e uova") va nella spesa. Sì nel campo di testo della
 *   PWA, no a voce, dove un rumore trascritto male non deve finire in lista.
 */
export type Context = { now: Date; timezone: string; timers?: string[]; deadlines?: string[]; bareIsShopping?: boolean };
