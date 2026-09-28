// Livello 2 dell'interprete: un modello linguistico, opzionale, dietro la stessa interfaccia (Fallback).
// Una sola implementazione per tutti: Ollama in locale, Groq e Gemini (gratuiti), OpenAI o altri a pagamento
// parlano lo stesso formato "compatibile OpenAI" (/chat/completions). Si sceglie con variabili d'ambiente:
//
//   ROBY_LLM=none|ollama|groq|gemini|openai|custom   (predefinito: none)
//   ROBY_LLM_MODEL, ROBY_LLM_KEY, ROBY_LLM_URL (per custom, o per un Ollama su un'altra macchina)
//   ROBY_LLM_NOTES=si                                 le note possono andare a un modello in cloud (vedi sotto)
//
// Cosa esce di casa:
// - interpretare una frase non capita: solo quella frase (più ora, fuso, nomi di timer e scadenze);
// - rispondere dalle note: la domanda e il testo delle note trovate. Per questo succede di default solo con un
//   modello locale (Ollama in rete di casa); con un provider in cloud serve ROBY_LLM_NOTES=si.
// Il modello non esegue mai niente: restituisce JSON, che passa dallo schema degli intenti.

import { z } from "zod";
import { Intent, type Context } from "./schema.ts";

export type LlmConfig = { provider: string; url: string; model: string; key?: string; local: boolean; notes: boolean };

// ponytail: modelli predefiniti "piccoli e veloci" di oggi; i nomi cambiano, ROBY_LLM_MODEL li sostituisce.
const PRESETS: Record<string, { url: string; model: string }> = {
  ollama: { url: "http://127.0.0.1:11434/v1", model: "qwen2.5:3b" },
  groq: { url: "https://api.groq.com/openai/v1", model: "llama-3.1-8b-instant" },
  gemini: { url: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.5-flash-lite" },
  openai: { url: "https://api.openai.com/v1", model: "gpt-4.1-mini" },
};

/** La configurazione dalle variabili d'ambiente; null se il modello è spento. Lancia se è configurato male. */
export function llmFromEnv(env: Record<string, string | undefined>): LlmConfig | null {
  const provider = (env.ROBY_LLM ?? "none").trim().toLowerCase();
  if (!provider || provider === "none") return null;
  const preset = PRESETS[provider];
  if (!preset && provider !== "custom") throw new Error(`ROBY_LLM sconosciuto: ${provider} (none, ollama, groq, gemini, openai, custom)`);
  const url = (env.ROBY_LLM_URL || preset?.url || "").replace(/\/+$/, "");
  const model = env.ROBY_LLM_MODEL || preset?.model || "";
  if (!url || !model) throw new Error("Con ROBY_LLM=custom servono ROBY_LLM_URL e ROBY_LLM_MODEL");
  const key = env.ROBY_LLM_KEY || undefined;
  if (!key && provider !== "ollama" && provider !== "custom") throw new Error(`Con ROBY_LLM=${provider} serve ROBY_LLM_KEY`);
  // "Locale": sulla rete di casa (Ollama sul Pi, o su un altro computer di casa).
  const local = /^http:\/\/(127\.|localhost|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|[^/]*\.local\b)/.test(url);
  const notes = local || /^(si|sì|1|true|yes)$/i.test(env.ROBY_LLM_NOTES ?? "");
  return { provider, url, model, ...(key ? { key } : {}), local, notes };
}

type Fetch = typeof fetch;
type Message = { role: "system" | "user"; content: string };

/** Una richiesta /chat/completions con risposta in JSON. Lancia su rete, tempo scaduto o risposta non valida. */
export async function chatJson(cfg: LlmConfig, messages: Message[], { timeoutMs = 6000, fetchImpl = fetch as Fetch } = {}): Promise<unknown> {
  const res = await fetchImpl(`${cfg.url}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cfg.key ? { Authorization: `Bearer ${cfg.key}` } : {}) },
    body: JSON.stringify({ model: cfg.model, messages, temperature: 0, response_format: { type: "json_object" } }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`${cfg.provider}: HTTP ${res.status}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error(`${cfg.provider}: risposta vuota`);
  return JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, ""));
}

const SCHEMA = JSON.stringify(z.toJSONSchema(Intent));

function now(ctx: Context) {
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("it-IT", { timeZone: ctx.timezone, ...o }).format(ctx.now);
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: ctx.timezone }).format(ctx.now);
  return `Oggi è ${f({ weekday: "long" })} ${date}, sono le ${f({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" })} (fuso ${ctx.timezone}).`;
}

export function interpretPrompt(ctx: Context): string {
  return [
    "Sei l'interprete dei comandi di Roby, l'assistente vocale di una casa italiana.",
    "Trasforma la frase dell'utente in UN oggetto JSON conforme a questo JSON Schema (campo \"type\" obbligatorio):",
    SCHEMA,
    "Regole: date in formato YYYY-MM-DD e ore HH:MM nel fuso della casa; i nomi (cose da comprare, titoli) in italiano, brevi;",
    "timer.start vuole la durata in secondi; se la frase non è uno di questi comandi rispondi {\"type\":\"unknown\",\"text\":\"<la frase>\"}.",
    "Non inventare: se manca un dato indispensabile, rispondi unknown.",
    now(ctx),
    ctx.timers?.length ? `Timer attivi: ${ctx.timers.join(", ")}.` : "",
    ctx.deadlines?.length ? `Scadenze aperte: ${ctx.deadlines.join(", ")}.` : "",
  ].filter(Boolean).join("\n");
}

/** Il ripiego per interpret(): la risposta la valida lo schema, qui si chiede e basta. */
export function llmFallback(cfg: LlmConfig, fetchImpl: Fetch = fetch) {
  return {
    name: `${cfg.provider}:${cfg.model}`,
    interpret: (text: string, ctx: Context) =>
      chatJson(cfg, [{ role: "system", content: interpretPrompt(ctx) }, { role: "user", content: text }], { fetchImpl }),
  };
}

export type NoteForLlm = { body: string; date: string };
const NoteAnswer = z.object({ risposta: z.string().trim().min(1).max(400).nullable(), nota: z.int().min(1).nullable() });

/**
 * Risponde a una domanda basandosi SOLO sulle note date (le più pertinenti, già trovate da chi chiama).
 * Restituisce la risposta e la nota usata (indice), oppure null se nelle note la risposta non c'è.
 */
export async function answerFromNotes(cfg: LlmConfig, question: string, notes: NoteForLlm[], fetchImpl: Fetch = fetch): Promise<{ text: string; note: number } | null> {
  const list = notes.map((n, i) => `${i + 1}. (${n.date}) ${n.body}`).join("\n");
  const raw = await chatJson(cfg, [
    {
      role: "system",
      content: [
        "Sei Roby, l'assistente di casa. Rispondi alla domanda usando SOLO le note qui sotto, scritte dagli abitanti della casa.",
        "Rispondi in italiano, con una frase breve e naturale, da dire a voce. Se nessuna nota contiene la risposta, non inventare.",
        "Rispondi con JSON: {\"risposta\": \"<frase>\" oppure null, \"nota\": <numero della nota usata> oppure null}.",
        "Note:",
        list,
      ].join("\n"),
    },
    { role: "user", content: question },
  ], { fetchImpl });
  const parsed = NoteAnswer.safeParse(raw);
  if (!parsed.success || !parsed.data.risposta || !parsed.data.nota || parsed.data.nota > notes.length) return null;
  return { text: parsed.data.risposta, note: parsed.data.nota - 1 };
}
