// Dall'intento all'azione: modifica la copia locale (che poi va a Supabase) e prepara cosa dire e cosa mostrare.
// Le frasi sono da ascoltare, non da leggere: brevi, con le date dette come si dicono.

import { randomUUID } from "node:crypto";
import type { AnswerPanel } from "@homeboard/core/protocol";
import { arrange, guessCategory, normalize, positionBetween, type Item, type Stat } from "@homeboard/core/items";
import { addDays, daysBetween, describe, nextOccurrence, nextReminderAt, zonedDate, type PlainDate, type Recurrence } from "@homeboard/core/recurrence";
import { secondsLeft, spoken } from "@homeboard/core/timers";
import { sameThing, type Intent } from "@homeboard/intents";
import type { BrainOp, Row, Store } from "./store.ts";
import type { Timers } from "./timers.ts";

export type Result = {
  reply: string;
  /** Cosa mostrare su /casa; null: niente pannello di risposta (per esempio si vede il timer appena partito). */
  panel: AnswerPanel | null;
};

export type Ctx = { store: Store; timers: Timers; householdId: string; timezone: string; now: Date };

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

export function execute(intent: Intent, { store, timers, householdId, timezone, now }: Ctx): Result {
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
      // ponytail: per parole (le più in comune vincono), finché non arriva la ricerca per significato (fase 7).
      const words = intent.question.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 3);
      const scored = store.live("notes")
        .map((n) => ({ n, score: words.filter((w) => sameThing(w, String(n.body))).length }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score || String(b.n.created_at).localeCompare(String(a.n.created_at)));
      const best = scored[0]?.n;
      return best
        ? { reply: `Mi hai detto: ${lower(String(best.body))}`, panel: { kind: "note", body: String(best.body) } }
        : { reply: "Non ho niente annotato su questo.", panel: { kind: "text" } };
    }

    case "confirm": case "cancel":
      return { reply: "Non c'era niente da confermare.", panel: null };
    case "unknown":
      if (intent.text.trim()) {
        ops.push({ table: "unparsed_log", kind: "insert", itemId: randomUUID(), row: { household_id: householdId, text: intent.text.slice(0, 500), source: "voce" } });
      }
      return done({ reply: "Scusa, non ho capito.", panel: { kind: "text" } });
  }
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function dueSentence(d: Row, today: PlainDate) {
  const n = daysBetween(today, String(d.due_date));
  const title = String(d.title);
  if (n < 0) return `${title} è scaduta da ${-n} ${n === -1 ? "giorno" : "giorni"}.`;
  if (n === 0) return `${title} scade oggi.`;
  if (n <= 2) return `${title} scade ${day(String(d.due_date), today)}.`;
  return `${title} scade tra ${n} giorni, ${day(String(d.due_date), today)}.`;
}
