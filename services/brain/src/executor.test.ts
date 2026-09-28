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

test("spesa: aggiungere, non duplicare, togliere", async () => {
  const { store, say } = setup();
  assert.equal((await say("aggiungi latte e uova alla spesa")).reply, "Aggiunti: latte e uova.");
  assert.deepEqual(shoppingList(store), ["Latte", "Uova"]);
  assert.equal((await say("aggiungi il latte")).reply, "Latte c'era già.");
  assert.equal((await say("togli il latte")).reply, "Tolto.");
  assert.deepEqual(shoppingList(store), ["Uova"]);
  assert.equal((await say("togli il pane")).reply, "Non trovo pane nella lista.");
  assert.equal((await say("cosa manca?")).reply, "Da prendere: uova.");
  const inserts = store.queue().filter((e) => e.op.kind === "insert");
  assert.equal(inserts.length, 2, "due righe da mandare a Supabase");
  assert.equal(inserts[0]!.op.kind === "insert" && inserts[0]!.op.row.category, "latticini", "reparto indovinato");
});

test("timer: parte, si interroga, suona, si ferma", async () => {
  const { ctx, say } = setup();
  assert.equal((await say("timer pasta dieci minuti")).reply, "Timer pasta: 10 minuti.");
  assert.equal((await say("quanto manca alla pasta?")).reply, "Pasta: mancano 10 minuti.");
  const { started } = ctx.timers.tick(new Date(now.getTime() + 600_000));
  assert.equal(started.length, 1);
  assert.equal(ctx.timers.ringing, true);
  assert.equal((await say("basta")).reply, "Fermato.");
  assert.equal(ctx.timers.list.length, 0);
});

test("promemoria: riga pronta per le notifiche", async () => {
  const { store, say } = setup();
  const r = await say("ricordami domani alle nove di chiamare l'idraulico");
  assert.equal(r.reply, "Te lo ricordo domani alle 9:00: chiamare l'idraulico.");
  const row = store.live("reminders")[0]!;
  assert.equal(row.next_at, "2026-09-29T07:00:00.000Z");
});

test("scadenze: si chiedono, e segnate fatte si rinnovano", async () => {
  const { store, say } = setup();
  store.receive("deadlines", [{
    id: "d", household_id: "h", title: "Bolletta della luce", category: "bollette", start_date: "2026-08-10", due_date: "2026-10-10",
    recurrence: { freq: "month", interval: 2 }, notify_days: [7, 0], done_at: null, updated_at: "2026-09-01T00:00:00Z", deleted_at: null,
  }]);
  assert.equal((await say("quando scade la bolletta della luce?")).reply, "Bolletta della luce scade tra 12 giorni, sabato 10 ottobre.");
  assert.equal((await say("ho pagato la luce")).reply, "Segnato: bolletta della luce. La prossima volta è giovedì 10 dicembre.");
  const open = store.live("deadlines").filter((d) => !d.done_at);
  assert.deepEqual(open.map((d) => d.due_date), ["2026-12-10"]);
});

test("note: si salvano e si ritrovano", async () => {
  const { say } = setup();
  await say("ricorda che la chiave di scorta è da mia madre");
  await say("prendi nota: il codice del cancello è 4512");
  assert.equal((await say("dove sta la chiave di scorta?")).reply, "Oggi mi hai detto: la chiave di scorta è da mia madre.");
  assert.equal((await say("qual è il codice del cancello?")).reply, "Oggi mi hai detto: il codice del cancello è 4512.");
  assert.equal((await say("dove ho messo il passaporto?")).reply, "Non ho niente annotato su questo.");
});

test("non capita: si registra per migliorare le regole", async () => {
  const { store, say } = setup();
  assert.equal((await say("accendi la luce")).reply, "Scusa, non ho capito.");
  assert.equal(store.queue().at(-1)!.op.table, "unparsed_log");
});

test("viste: mostrami…", async () => {
  const { store, say } = setup();
  await say("aggiungi latte e uova");
  await say("ricordami domani alle nove di chiamare l'idraulico");
  const shopping = await say("fammi vedere la spesa");
  assert.deepEqual([shopping.reply, shopping.panel], ["Da prendere: 2 cose.", { kind: "shopping", items: ["Latte", "Uova"] }]);
  const reminders = await say("mostrami i promemoria");
  assert.equal(reminders.reply, "1 promemoria nei prossimi giorni.");
  assert.deepEqual(reminders.panel, { kind: "reminders", items: [{ title: "Chiamare l'idraulico", at: "2026-09-29T07:00:00.000Z" }] });
  assert.equal((await say("cosa c'è oggi?")).reply, "Oggi: nessun promemoria, 2 cose da comprare.");
  assert.equal((await say("quali scadenze ci sono?")).reply, "Nessuna scadenza in vista.");
  assert.equal((await say("fammi vedere le note")).panel?.kind, "notes");
  void store;
});
