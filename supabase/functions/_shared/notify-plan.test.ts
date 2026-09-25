import { test } from "node:test";
import assert from "node:assert/strict";
import { planDeadlines, planReminders, type DeadlineRow, type ReminderRow } from "./notify-plan.ts";

const tz = () => "Europe/Rome";
const plastica: ReminderRow = {
  id: "r1", household_id: "h", title: "Plastica", note: null, start_date: "2026-09-25", at_time: "21:00:00",
  recurrence: { freq: "week", interval: 1, byWeekday: [1, 4] }, next_at: "2026-09-29T19:00:00.000Z", // martedì 21:00
};

test("promemoria all'ora giusta: messaggio, e next_at passa al venerdì", () => {
  const now = new Date("2026-09-29T19:00:20Z");
  const { messages, updates } = planReminders([plastica], now, tz);
  assert.equal(messages.length, 1);
  assert.equal(messages[0]!.body, "Promemoria delle 21:00");
  assert.equal(messages[0]!.key, plastica.next_at, "chiave = occorrenza: niente doppioni se il giro si ripete");
  assert.deepEqual(updates, [{ id: "r1", next_at: "2026-10-02T19:00:00.000Z" }]);
});

test("promemoria non ancora dovuto: niente", () => {
  const { messages, updates } = planReminders([plastica], new Date("2026-09-29T18:59:00Z"), tz);
  assert.equal(messages.length + updates.length, 0);
});

test("promemoria in ritardo di ore (server fermo): non si manda, si passa al prossimo", () => {
  const { messages, updates } = planReminders([plastica], new Date("2026-09-30T08:00:00Z"), tz);
  assert.equal(messages.length, 0);
  assert.equal(updates[0]!.next_at, "2026-10-02T19:00:00.000Z");
});

test("promemoria una volta sola: dopo l'invio next_at diventa null; la nota diventa il testo", () => {
  const once: ReminderRow = { ...plastica, recurrence: null, note: "Portare la ricetta", next_at: "2026-09-29T19:00:00.000Z", start_date: "2026-09-29" };
  const { messages, updates } = planReminders([once], new Date("2026-09-29T19:00:05Z"), tz);
  assert.equal(messages[0]!.body, "Portare la ricetta");
  assert.deepEqual(updates, [{ id: "r1", next_at: null }]);
});

const bollo: DeadlineRow = { id: "d1", household_id: "h", title: "Bollo auto", due_date: "2026-10-15", notify_days: [30, 7, 0] };

test("scadenza: avviso il giorno dell'anticipo, dalle 9 ora di casa", () => {
  assert.equal(planDeadlines([bollo], new Date("2026-10-08T06:59:00Z"), tz).length, 0, "8:59 in Italia: troppo presto");
  const [m] = planDeadlines([bollo], new Date("2026-10-08T07:05:00Z"), tz);
  assert.equal(m!.key, "2026-10-15:7");
  assert.equal(m!.body, "Scade tra 7 giorni, giovedì 15 ottobre.");
  assert.equal(planDeadlines([bollo], new Date("2026-10-15T10:00:00Z"), tz)[0]!.body, "Scade oggi.");
  assert.equal(planDeadlines([bollo], new Date("2026-10-10T10:00:00Z"), tz).length, 0, "nessun anticipo cade oggi");
});
