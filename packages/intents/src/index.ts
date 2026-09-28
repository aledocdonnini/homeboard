// Interprete dei comandi: una frase in italiano diventa un intento strutturato, validato con uno schema.
// Lo usano brain sul Raspberry (voce) e la PWA (campo di testo e "premi e parla"): la stessa frase dà la
// stessa azione ovunque. L'interprete non esegue niente: decide soltanto cosa si è chiesto.
//
// Due livelli:
//   1. parse(): regole e modelli di frase, istantaneo, copre la grande maggioranza dei comandi.
//   2. Fallback (opzionale): un modello linguistico per le frasi che le regole non capiscono. Restituisce
//      JSON che passa dallo stesso schema: se non è valido, la frase resta "non capita".

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
  z.object({ type: z.literal("unknown"), text: z.string() }),
]);
export type Intent = z.infer<typeof Intent>;
export type IntentType = Intent["type"];

/** Azioni che chiedono conferma a voce prima di partire ("svuota la lista" → "Confermi?"). */
export const DESTRUCTIVE: ReadonlySet<IntentType> = new Set(["shopping.clear"]);

/** Contesto per date e orari relativi ("domani alle otto"): l'istante di adesso e il fuso della casa. */
export type Context = { now: Date; timezone: string };

/** Livello 1: regole. Mai lento, mai in rete. */
export function parse(text: string, _ctx: Context): Intent {
  return { type: "unknown", text };
}

/**
 * Livello 2: un modello linguistico dietro un'interfaccia. Implementazioni previste (config, fase 8):
 * none (predefinito), ollama in locale, un provider compatibile OpenAI (Groq, o uno a pagamento), Gemini.
 * Restituisce JSON grezzo: lo valida interpret(), il modello non esegue mai niente.
 */
export interface Fallback {
  readonly name: string;
  interpret(text: string, ctx: Context): Promise<unknown>;
}

export type Interpretation = { intent: Intent; by: "rules" | string };

export async function interpret(text: string, ctx: Context, fallback?: Fallback): Promise<Interpretation> {
  const intent = parse(text, ctx);
  if (intent.type !== "unknown" || !fallback) return { intent, by: "rules" };
  try {
    const checked = Intent.safeParse(await fallback.interpret(text, ctx));
    if (checked.success && checked.data.type !== "unknown") return { intent: checked.data, by: fallback.name };
  } catch {
    // Modello irraggiungibile o lento: la frase resta non capita, come senza modello.
  }
  return { intent, by: "rules" };
}
