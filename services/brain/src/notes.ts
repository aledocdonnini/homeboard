// Il second brain: le note di casa si ritrovano per significato ("dove sono le pile?" trova "le batterie di
// ricambio sono nel cassetto"), anche senza internet.
//
// - Embedding in locale, con un modello multilingue piccolo (paraphrase-multilingual-MiniLM-L12-v2, 384 dimensioni,
//   ~120 MB quantizzato, ~1 ms a frase): lo stesso formato della colonna notes.embedding in Supabase.
// - Ogni nota ha il suo embedding nella copia locale; la prima volta va anche su Supabase (per chi vorrà
//   cercare da lì). La ricerca la fa brain, qui: funziona offline.
// - Punteggio: somiglianza (coseno) più un piccolo premio per le parole in comune. Sotto la soglia: "non so".
//   Senza modello (non ancora caricato, o mancante) restano le sole parole.
// - Risposta: la nota più pertinente con data e origine ("Il 12 marzo mi hai detto: …"). In fase 8 un modello
//   linguistico potrà rispondere con parole sue, dietro l'interfaccia Answerer, citando sempre la nota.

import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import { sameThing } from "@homeboard/intents";
import type { BrainOp, Row, Store } from "./store.ts";

const MODEL = "Xenova/paraphrase-multilingual-MiniLM-L12-v2";
/**
 * Misurate su note e domande di casa (npm run eval:note): le risposte giuste stanno quasi tutte sopra 0,6, le domande
 * senza nota sotto 0,3. In mezzo ci sono le domande "vicine" (caricabatterie → batterie): Roby risponde "forse".
 */
export const THRESHOLD = 0.45;
export const SURE = 0.6;
const WORD_BONUS = 0.1;
/** Parole che non dicono niente sul contenuto: senza, "dove sono le pile?" troverebbe ogni nota con "sono". */
const STOP = new Set(["dove", "sono", "quando", "come", "cosa", "quale", "quali", "dimmi", "sai", "sapere", "ricordi",
  "ricordami", "hai", "ho", "abbiamo", "messo", "mettere", "stato", "stata", "stanno", "sta", "qual", "questo", "questa",
  "quello", "quella", "anche", "ancora", "perché", "chi", "casa", "scade", "scadono", "fatto", "fare", "serve", "servono"]);

export interface Embedder {
  embed(texts: string[]): Promise<number[][]>;
}

/** Il modello vero (transformers.js). Si scarica la prima volta in ~/.local/share/roby/models/transformers. */
export async function loadEmbedder(): Promise<Embedder> {
  const { env, pipeline } = await import("@huggingface/transformers");
  env.cacheDir = join(process.env.ROBY_MODELS ?? join(homedir(), ".local/share/roby/models"), "transformers");
  const extract = await pipeline("feature-extraction", MODEL, { dtype: "q8" });
  return {
    async embed(texts) {
      const out = await extract(texts, { pooling: "mean", normalize: true });
      return out.tolist() as number[][];
    },
  };
}

type Cached = { hash: string; vector: number[] };
const hash = (text: string) => createHash("sha1").update(text).digest("hex").slice(0, 16);
const key = (id: string) => `emb:${id}`;
const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * (b[i] ?? 0), 0);

/**
 * Calcola gli embedding che mancano (note nuove o cambiate). Salva in locale e mette in coda l'aggiornamento
 * per Supabase. Restituisce quante note ha calcolato.
 */
export async function index(store: Store, embedder: Embedder): Promise<number> {
  const todo = store.live("notes").filter((n) => store.get<Cached>(key(n.id))?.hash !== hash(String(n.body)));
  if (!todo.length) return 0;
  const vectors = await embedder.embed(todo.map((n) => String(n.body)));
  const ops: BrainOp[] = [];
  todo.forEach((n, i) => {
    const vector = vectors[i]!.map((x) => Math.round(x * 1e6) / 1e6);
    store.set(key(n.id), { hash: hash(String(n.body)), vector });
    ops.push({ table: "notes", kind: "update", itemId: n.id, patch: { embedding: vector } });
  });
  store.change(ops);
  return todo.length;
}

export type Found = { note: Row; score: number };

/** La nota più pertinente, o null se nessuna supera la soglia. */
export async function search(store: Store, question: string, embedder: Embedder | null): Promise<Found | null> {
  const notes = store.live("notes");
  if (!notes.length) return null;
  const words = question.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 3 && !STOP.has(w));
  const hits = (n: Row) => words.filter((w) => sameThing(w, String(n.body))).length;

  let query: number[] | undefined;
  if (embedder) {
    try {
      [query] = await embedder.embed([question]);
    } catch (e) {
      console.warn("Embedding non riuscito, cerco per parole:", (e as Error).message);
    }
  }
  const scored = notes.map((note) => {
    const vector = store.get<Cached>(key(note.id))?.vector;
    const score = query && vector ? dot(query, vector) + WORD_BONUS * hits(note) : hits(note) > 0 ? THRESHOLD + WORD_BONUS * hits(note) : 0;
    return { note, score };
  }).sort((a, b) => b.score - a.score || String(b.note.created_at).localeCompare(String(a.note.created_at)));
  const best = scored[0]!;
  return best.score >= THRESHOLD ? best : null;
}

/** Livello di fase 8: un modello linguistico risponde basandosi solo sulle note trovate. Senza, si legge la nota. */
export interface Answerer {
  answer(question: string, notes: Row[]): Promise<string | null>;
}

const SAID: Record<string, string> = { voce: "mi hai detto", pwa: "hai scritto", share: "hai salvato" };

/**
 * "Il 12 marzo mi hai detto: la chiave di scorta è da mia madre." — sempre con data e origine.
 * Con `unsure` (punteggio fra THRESHOLD e SURE) Roby lo dice: "Forse intendi questo. Il 12 marzo…".
 */
export function cite(note: Row, now: Date, timezone: string, unsure = false): string {
  const day = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(d);
  const created = new Date(String(note.created_at));
  const when = day(created) === day(now) ? "Oggi"
    : day(created) === day(new Date(now.getTime() - 86_400_000)) ? "Ieri"
    : `Il ${created.toLocaleDateString("it-IT", { timeZone: timezone, day: "numeric", month: "long", ...(created.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}) })}`;
  const body = String(note.body).replace(/[.!?]*$/, "");
  return `${unsure ? "Forse intendi questo. " : ""}${when} ${SAID[String(note.source)] ?? "mi hai detto"}: ${body.charAt(0).toLowerCase()}${body.slice(1)}.`;
}
