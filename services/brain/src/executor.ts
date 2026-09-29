// Dall'intento all'azione: modifica la copia locale (che poi va a Supabase) e prepara cosa dire e cosa mostrare.
// Le frasi sono da ascoltare, non da leggere: brevi, con le date dette come si dicono.

import { randomUUID } from "node:crypto";
import type { AnswerPanel } from "@homeboard/core/protocol";
import { arrange, guessCategory, normalize, positionBetween, type Item, type Stat } from "@homeboard/core/items";
import { addDays, daysBetween, describe, nextOccurrence, nextReminderAt, zonedDate, type PlainDate, type Recurrence } from "@homeboard/core/recurrence";
import { secondsLeft, spoken } from "@homeboard/core/timers";
import { answerFromNotes, sameThing, smalltalkReply, type Intent, type LlmConfig } from "@homeboard/intents";
import type { BrainOp, Row, Store } from "./store.ts";
import { cite, noteDay, origin, rank, search, SURE, type Embedder } from "./notes.ts";
import type { Timers } from "./timers.ts";
import type { Music } from "./music.ts";
import { upcoming } from "./state.ts";

export type Result = {
  reply: string;
  /** Cosa mostrare su /casa; null: niente pannello di risposta (per esempio si vede il timer appena partito). */
  panel: AnswerPanel | null;
};

export type Ctx = {
  store: Store; timers: Timers; householdId: string; timezone: string; now: Date;
  /** Il modello per cercare le note per significato; null finché non è pronto (si cerca per parole). */
  embedder?: Embedder | null;
  /** Un modello linguistico autorizzato per le note: risponde lui, basandosi solo sulle note trovate. */
  llm?: LlmConfig | null;
  /** Spotify sul Pi (go-librespot); assente sul Mac o se non è installato. */
  music?: Music | null;
};

const and = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} e ${xs.at(-1)}`);
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const day = (d: PlainDate, today: PlainDate) => {
  if (d === today) return "oggi";
  if (d === addDays(today, 1)) return "domani";
  if (d === addDays(today, 2)) return "dopodomani";
  return new Date(`${d}T12:00:00Z`).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
};
const hhmm = (t: string) => t.slice(0, 5).replace(/^0/, "");

/** Le cose da prendere, nell'ordine dei reparti. */
export const shoppingList = (store: Store) =>
  arrange(store.live("shopping_items") as unknown as Item[]).groups.flatMap((g) => g.items.map((i) => i.name));

export const openDeadlines = (store: Store) =>
  store.live("deadlines").filter((d) => !d.done_at).sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));

export async function execute(intent: Intent, { store, timers, householdId, timezone, now, embedder = null, llm = null, music = null }: Ctx): Promise<Result> {
  const today = zonedDate(now, timezone);
  const ops: BrainOp[] = [];
  const done = (r: Result) => {
    if (ops.length) store.change(ops);
    return r;
  };

  switch (intent.type) {
    case "shopping.add": {
      const live = store.live("shopping_items");
      const stats = store.get<Stat[]>("stats") ?? [];
      const added: string[] = [], already: string[] = [];
      for (const name of intent.items) {
        const existing = live.find((i) => normalize(String(i.name)) === normalize(name));
        if (existing && !existing.checked) { already.push(name); continue; }
        if (existing) ops.push({ table: "shopping_items", kind: "update", itemId: existing.id, patch: { checked: false } });
        else {
          const category = guessCategory(name, stats);
          const last = Math.max(-1, ...live.filter((i) => i.category === category).map((i) => Number(i.position)));
          const row = { id: randomUUID(), household_id: householdId, name, category, position: positionBetween(last) };
          ops.push({ table: "shopping_items", kind: "insert", itemId: row.id, row });
          live.push({ ...row, updated_at: "", deleted_at: null, checked: false });
        }
        added.push(name);
      }
      if (ops.length) store.change(ops);
      const reply = added.length
        ? `Aggiunt${added.length > 1 ? "i" : "o"}: ${and(added.map(lower))}.${already.length ? ` ${and(already.map(lower))} c'era già.` : ""}`
        : `${capital(and(already.map(lower)))} c'era già.`;
      return { reply, panel: { kind: "shopping", items: shoppingList(store) } };
    }
    case "shopping.remove": {
      const live = store.live("shopping_items");
      const found = intent.items.map((name) => live.find((i) => sameThing(name, String(i.name))));
      for (const i of found) if (i) ops.push({ table: "shopping_items", kind: "update", itemId: i.id, patch: { deleted_at: now.toISOString() } });
      if (ops.length) store.change(ops);
      const missing = intent.items.filter((_, k) => !found[k]);
      const reply = ops.length
        ? `Tolt${ops.length > 1 ? "i" : "o"}.${missing.length ? ` ${capital(and(missing.map(lower)))} non c'era.` : ""}`
        : `Non trovo ${and(missing.map(lower))} nella lista.`;
      return { reply, panel: { kind: "shopping", items: shoppingList(store) } };
    }
    case "shopping.list": {
      const items = shoppingList(store);
      return { reply: items.length ? `Da prendere: ${and(items.map(lower))}.` : "La lista è vuota.", panel: { kind: "shopping", items } };
    }
    case "shopping.clear":
      for (const i of store.live("shopping_items")) ops.push({ table: "shopping_items", kind: "update", itemId: i.id, patch: { deleted_at: now.toISOString() } });
      return done({ reply: "Fatto, la lista è vuota.", panel: { kind: "shopping", items: [] } });

    case "timer.start": {
      const t = timers.start(intent.seconds, intent.label, now);
      return { reply: `Timer${t.label ? ` ${t.label}` : ""}: ${spoken(intent.seconds)}.`, panel: null };
    }
    case "timer.query": {
      const found = timers.find(intent.label);
      if (!found.length) return { reply: intent.label ? `Non c'è un timer ${intent.label}.` : "Nessun timer attivo.", panel: null };
      return {
        reply: found.map((t) => `${t.label ? capital(t.label) : "Il timer"}: ${t.status === "ringing" ? "è finito" : `mancano ${spoken(secondsLeft(t.endsAt, now))}`}`).join(". ") + ".",
        panel: null,
      };
    }
    case "timer.stop": {
      const stopped = timers.stop(intent.label);
      // "Basta" o "stop" senza timer da fermare: si ferma la musica, se suona.
      if (!stopped.length && !intent.label && music?.now?.playing) return playMusic({ type: "music", action: "pause" }, music);
      return { reply: stopped.length ? (stopped.length > 1 ? "Fermati." : "Fermato.") : "Non c'era niente da fermare.", panel: null };
    }

    case "reminder.create": {
      const recurrence = intent.recurrence ?? null;
      const next = nextReminderAt(intent.date, intent.time, recurrence, now, timezone);
      const row = {
        id: randomUUID(), household_id: householdId, title: intent.title, start_date: intent.date, at_time: intent.time,
        recurrence, next_at: next?.toISOString() ?? null, note: null,
      };
      ops.push({ table: "reminders", kind: "insert", itemId: row.id, row });
      const when = recurrence ? `${lower(describe(recurrence))}, alle ${hhmm(intent.time)}` : `${day(intent.date, today)} alle ${hhmm(intent.time)}`;
      return done({ reply: `Te lo ricordo ${when}: ${lower(intent.title)}.`, panel: { kind: "reminder", title: intent.title, date: intent.date, time: intent.time } });
    }

    case "deadline.query": {
      const open = openDeadlines(store);
      if (!intent.title) {
        const first = open[0];
        return { reply: first ? `Ecco le scadenze. ${dueSentence(first, today)}` : "Nessuna scadenza in vista.", panel: { kind: "deadlines" } };
      }
      const found = intent.title ? open.filter((d) => sameThing(intent.title!, String(d.title))) : open.slice(0, 2);
      if (!found.length) return { reply: intent.title ? `Non trovo una scadenza ${intent.title}.` : "Nessuna scadenza in vista.", panel: null };
      const first = found[0]!;
      const reply = found.map((d) => dueSentence(d, today)).join(" ");
      return { reply, panel: { kind: "deadline", title: String(first.title), due: String(first.due_date) } };
    }
    case "deadline.complete": {
      const d = openDeadlines(store).find((o) => sameThing(intent.title, String(o.title)));
      if (!d) return { reply: `Non trovo una scadenza ${intent.title}.`, panel: null };
      ops.push({ table: "deadlines", kind: "update", itemId: d.id, patch: { done_at: now.toISOString() } });
      const recurrence = (d.recurrence ?? null) as Recurrence | null;
      const nextDue = recurrence ? nextOccurrence(String(d.start_date), recurrence, String(d.due_date), true) : null;
      if (nextDue) {
        const row = {
          id: randomUUID(), household_id: householdId, title: d.title, category: d.category, note: d.note ?? null,
          start_date: d.start_date, due_date: nextDue, recurrence, notify_days: d.notify_days,
        };
        ops.push({ table: "deadlines", kind: "insert", itemId: row.id, row });
      }
      return done({
        reply: `Segnato: ${lower(String(d.title))}.${nextDue ? ` La prossima volta è ${day(nextDue, today)}.` : ""}`,
        panel: nextDue ? { kind: "deadline", title: String(d.title), due: nextDue } : null,
      });
    }

    case "note.save": {
      const row = { id: randomUUID(), household_id: householdId, body: intent.body, source: "voce", created_at: now.toISOString() };
      ops.push({ table: "notes", kind: "insert", itemId: row.id, row });
      return done({ reply: "Me lo ricordo.", panel: { kind: "note", body: intent.body } });
    }
    case "note.ask": {
      const found = await rank(store, intent.question, embedder);
      const best = found[0];
      if (!best) return { reply: "Non ho niente annotato su questo.", panel: { kind: "text" } };
      if (llm?.notes) {
        // Il modello risponde solo dalle note trovate (le tre più pertinenti) e dice quale ha usato.
        const top = found.slice(0, 3);
        try {
          const a = await answerFromNotes(llm, intent.question, top.map((f) => ({ body: String(f.note.body), date: noteDay(f.note, now, timezone) })));
          if (!a) return { reply: "Non ho niente annotato su questo.", panel: { kind: "text" } };
          const used = top[a.note]!.note;
          return { reply: `${a.text} ${origin(used, now, timezone)}`, panel: { kind: "note", body: String(used.body) } };
        } catch (e) {
          console.warn("Modello linguistico non raggiungibile, leggo la nota:", (e as Error).message);
        }
      }
      return { reply: cite(best.note, now, timezone, best.score < SURE), panel: { kind: "note", body: String(best.note.body) } };
    }

    case "smalltalk":
      return { reply: smalltalkReply(intent.topic, now, timezone), panel: null };

    case "show":
      return showView(intent.view, store, timers, now, timezone);

    case "music":
      return playMusic(intent, music);
    case "confirm": case "cancel":
      return { reply: "Non c'era niente da confermare.", panel: null };
    case "unknown": {
      // Una domanda libera che le regole non riconoscono ("cosa mi serve per il tiramisù?") può avere la
      // risposta in una nota: se ce n'è una abbastanza pertinente, Roby risponde con quella.
      const found = intent.text.trim() ? await search(store, intent.text, embedder) : null;
      if (found) return { reply: cite(found.note, now, timezone, found.score < SURE), panel: { kind: "note", body: String(found.note.body) } };
      if (intent.text.trim()) {
        ops.push({ table: "unparsed_log", kind: "insert", itemId: randomUUID(), row: { household_id: householdId, text: intent.text.slice(0, 500), source: "voce" } });
      }
      return done({ reply: "Scusa, non ho capito.", panel: { kind: "text" } });
    }
  }
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** I comandi musicali: go-librespot sul Pi. Errori e assenze diventano frasi, non eccezioni. */
async function playMusic(intent: Extract<Intent, { type: "music" }>, music: Music | null): Promise<Result> {
  if (!music?.available) return { reply: "La musica non è attiva su questo Roby.", panel: null };
  if (music.link) return { reply: "Prima collega Spotify: il codice è sullo schermo.", panel: { kind: "music" } };
  try {
    switch (intent.action) {
      case "play": {
        if (!intent.query) { await music.resume(); return { reply: "Riprendo.", panel: { kind: "music" } }; }
        const found = await music.find(intent.query, intent.kind);
        if (!found) return { reply: `Non trovo ${intent.query} su Spotify.`, panel: null };
        await music.play(found.uri);
        return { reply: `Metto ${found.label}.`, panel: { kind: "music" } };
      }
      case "resume": await music.resume(); return { reply: "Riprendo.", panel: { kind: "music" } };
      case "pause": await music.pause(); return { reply: "In pausa.", panel: null };
      case "next": await music.next(); return { reply: "Avanti.", panel: { kind: "music" } };
      case "prev": await music.prev(); return { reply: "Torno indietro.", panel: { kind: "music" } };
      case "louder": await music.setVolume(10, true); return { reply: "Più forte.", panel: null };
      case "quieter": await music.setVolume(-10, true); return { reply: "Più piano.", panel: null };
      case "volume": await music.setVolume(intent.level ?? 50); return { reply: `Volume a ${intent.level ?? 50}.`, panel: null };
      case "what":
        return music.now
          ? { reply: `${music.now.playing ? "Sta suonando" : "In pausa"}: ${music.now.title} di ${music.now.artist}.`, panel: { kind: "music" } }
          : { reply: "Non sta suonando niente.", panel: null };
    }
  } catch (e) {
    console.warn("Musica:", (e as Error).message);
    return { reply: "Spotify non risponde, riprova tra poco.", panel: null };
  }
}
const count = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);

/** "Mostrami …": la vista al centro dello schermo, e una frase breve (la si guarda, non la si ascolta). */
function showView(view: Extract<Intent, { type: "show" }>["view"], store: Store, timers: Timers, now: Date, timezone: string): Result {
  const today = zonedDate(now, timezone);
  const soon = upcoming(store.live("reminders"), now, timezone).filter((r) => r.at.getTime() - now.getTime() < 14 * 86_400_000);
  switch (view) {
    case "shopping": {
      const items = shoppingList(store);
      return { reply: items.length ? `Da prendere: ${count(items.length, "cosa", "cose")}.` : "La lista è vuota.", panel: { kind: "shopping", items } };
    }
    case "timers":
      return { reply: timers.list.length ? `${capital(count(timers.list.length, "timer attivo", "timer attivi"))}.` : "Nessun timer attivo.", panel: { kind: "timers" } };
    case "reminders":
      return {
        reply: soon.length ? `${capital(count(soon.length, "promemoria", "promemoria"))} nei prossimi giorni.` : "Nessun promemoria in programma.",
        panel: { kind: "reminders", items: soon.slice(0, 10).map((r) => ({ title: r.title, at: r.at.toISOString() })) },
      };
    case "deadlines": {
      const first = openDeadlines(store)[0];
      return { reply: first ? `Ecco le scadenze. ${dueSentence(first, today)}` : "Nessuna scadenza in vista.", panel: { kind: "deadlines" } };
    }
    case "notes": {
      const notes = store.live("notes").sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 8);
      return {
        reply: notes.length ? "Ecco le ultime note." : "Non ci sono note: dimmi «ricorda che…».",
        panel: { kind: "notes", items: notes.map((n) => ({ body: String(n.body), when: noteDay(n, now, timezone) })) },
      };
    }
    case "settings":
      return { reply: "Le impostazioni della casa si aprono dal telefono o dal computer.", panel: null };
    case "today": {
      const todays = soon.filter((r) => zonedDate(r.at, timezone) === today);
      const close = openDeadlines(store).filter((d) => daysBetween(today, String(d.due_date)) <= 7);
      const items = shoppingList(store).length;
      const parts = [
        todays.length ? count(todays.length, "promemoria", "promemoria") : "nessun promemoria",
        close.length ? count(close.length, "scadenza vicina", "scadenze vicine") : "",
        items ? `${count(items, "cosa", "cose")} da comprare` : "",
      ].filter(Boolean);
      return { reply: `Oggi: ${parts.join(", ")}.`, panel: { kind: "today" } };
    }
  }
}

function dueSentence(d: Row, today: PlainDate) {
  const n = daysBetween(today, String(d.due_date));
  const title = String(d.title);
  if (n < 0) return `${title} è scaduta da ${-n} ${n === -1 ? "giorno" : "giorni"}.`;
  if (n === 0) return `${title} scade oggi.`;
  if (n <= 2) return `${title} scade ${day(String(d.due_date), today)}.`;
  return `${title} scade tra ${n} giorni, ${day(String(d.due_date), today)}.`;
}
