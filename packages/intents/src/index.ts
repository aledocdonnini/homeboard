// Interprete dei comandi: una frase in italiano diventa un intento strutturato, validato con uno schema.
// Lo usano brain sul Raspberry (voce) e la PWA (campo di testo e "premi e parla"): la stessa frase dà la
// stessa azione ovunque. L'interprete non esegue niente: decide soltanto cosa si è chiesto.
//
// Due livelli:
//   1. parse(): regole e modelli di frase, istantaneo, copre la grande maggioranza dei comandi.
//   2. Fallback (opzionale): un modello linguistico per le frasi che le regole non capiscono. Restituisce
//      JSON che passa dallo stesso schema: se non è valido, la frase resta "non capita".

import { Intent, type Context } from "./schema.ts";
import { parse } from "./rules.ts";

export * from "./schema.ts";
export { parse };
export { sameThing } from "./lexicon.ts";

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
