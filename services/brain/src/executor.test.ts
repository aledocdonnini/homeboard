import { test } from "node:test";
import assert from "node:assert/strict";
import { parse } from "@homeboard/intents";
import { execute, shoppingList } from "./executor.ts";
import { Store } from "./store.ts";
import { Timers } from "./timers.ts";

// Lunedì 28 settembre 2026, 10:00 a Roma.
const now = new Date("2026-09-28T08:00:00Z");
const setup = () => {
  const store = new Store();
  const ctx = { store, timers: new Timers(store), householdId: "h", timezone: "Europe/Rome", now };
  // Come main.ts: l'interprete riceve i nomi dei timer e delle scadenze in corso.
  const say = (text: string) => execute(parse(text, {
    now, timezone: "Europe/Rome",
    timers: ctx.timers.list.flatMap((t) => (t.label ? [t.label] : [])),
    deadlines: store.live("deadlines").map((d) => String(d.title)),
  }), ctx);
  return { store, ctx, say };
};

test("spesa: aggiungere, non duplicare, togliere", () => {
  const { store, say } = setup();
  assert.equal(say("aggiungi latte e uova alla spesa").reply, "Aggiunti: latte e uova.");
  assert.deepEqual(shoppingList(store), ["Latte", "Uova"]);
  assert.equal(say("aggiungi il latte").reply, "Latte c'era già.");
  assert.equal(say("togli il latte").reply, "Tolto.");
  assert.deepEqual(shoppingList(store), ["Uova"]);
  assert.equal(say("togli il pane").reply, "Non trovo pane nella lista.");
  assert.equal(say("cosa manca?").reply, "Da prendere: uova.");
  const inserts = store.queue().filter((e) => e.op.kind === "insert");
  assert.equal(inserts.length, 2, "due righe da mandare a Supabase");
  assert.equal(inserts[0]!.op.kind === "insert" && inserts[0]!.op.row.category, "latticini", "reparto indovinato");
});

test("timer: parte, si interroga, suona, si ferma", () => {
  const { ctx, say } = setup();
  assert.equal(say("timer pasta dieci minuti").reply, "Timer pasta: 10 minuti.");
  assert.equal(say("quanto manca alla pasta?").reply, "Pasta: mancano 10 minuti.");
  const { started } = ctx.timers.tick(new Date(now.getTime() + 600_000));
  assert.equal(started.length, 1);
  assert.equal(ctx.timers.ringing, true);
  assert.equal(say("basta").reply, "Fermato.");
  assert.equal(ctx.timers.list.length, 0);
});

test("promemoria: riga pronta per le notifiche", () => {
  const { store, say } = setup();
  const r = say("ricordami domani alle nove di chiamare l'idraulico");
  assert.equal(r.reply, "Te lo ricordo domani alle 9:00: chiamare l'idraulico.");
  const row = store.live("reminders")[0]!;
  assert.equal(row.next_at, "2026-09-29T07:00:00.000Z");
});

test("scadenze: si chiedono, e segnate fatte si rinnovano", () => {
  const { store, say } = setup();
  store.receive("deadlines", [{
    id: "d", household_id: "h", title: "Bolletta della luce", category: "bollette", start_date: "2026-08-10", due_date: "2026-10-10",
    recurrence: { freq: "month", interval: 2 }, notify_days: [7, 0], done_at: null, updated_at: "2026-09-01T00:00:00Z", deleted_at: null,
  }]);
  assert.equal(say("quando scade la bolletta della luce?").reply, "Bolletta della luce scade tra 12 giorni, sabato 10 ottobre.");
  assert.equal(say("ho pagato la luce").reply, "Segnato: bolletta della luce. La prossima volta è giovedì 10 dicembre.");
  const open = store.live("deadlines").filter((d) => !d.done_at);
  assert.deepEqual(open.map((d) => d.due_date), ["2026-12-10"]);
});

test("note: si salvano e si ritrovano", () => {
  const { say } = setup();
  say("ricorda che la chiave di scorta è da mia madre");
  say("prendi nota: il codice del cancello è 4512");
  assert.equal(say("dove sta la chiave di scorta?").reply, "Mi hai detto: la chiave di scorta è da mia madre");
  assert.equal(say("qual è il codice del cancello?").reply, "Mi hai detto: il codice del cancello è 4512");
  assert.equal(say("dove ho messo il passaporto?").reply, "Non ho niente annotato su questo.");
});

test("non capita: si registra per migliorare le regole", () => {
  const { store, say } = setup();
  assert.equal(say("accendi la luce").reply, "Scusa, non ho capito.");
  assert.equal(store.queue().at(-1)!.op.table, "unparsed_log");
});
