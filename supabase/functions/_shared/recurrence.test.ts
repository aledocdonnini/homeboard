import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addMonths, describe, nextOccurrence, nextReminderAt, notifyDates, occurrencesBetween, weekday, zonedDate, zonedInstant,
  type Recurrence,
} from "./recurrence.ts";

const monthly: Recurrence = { freq: "month", interval: 1 };
const TZ = "Europe/Rome";

test("addMonths: fine mese e anni bisestili", () => {
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonths("2028-01-31", 1), "2028-02-29");
  assert.equal(addMonths("2026-01-31", 2), "2026-03-31");
  assert.equal(addMonths("2026-11-30", 3), "2027-02-28");
  assert.equal(addMonths("2026-03-15", -3), "2025-12-15");
});

test("mensile dal 31: niente deriva, torna al 31 quando il mese lo ha", () => {
  assert.deepEqual(occurrencesBetween("2026-01-31", monthly, "2026-01-01", "2026-05-31"),
    ["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31"]);
});

test("annuale dal 29 febbraio e ogni 2 anni (bollo, revisione)", () => {
  const yearly: Recurrence = { freq: "year", interval: 1 };
  assert.equal(nextOccurrence("2024-02-29", yearly, "2026-01-01"), "2026-02-28");
  assert.equal(nextOccurrence("2024-02-29", yearly, "2027-03-01"), "2028-02-29");
  const biennial: Recurrence = { freq: "year", interval: 2 };
  assert.equal(nextOccurrence("2025-06-10", biennial, "2025-06-11"), "2027-06-10");
  assert.equal(nextOccurrence("2025-06-10", biennial, "2027-06-10"), "2027-06-10", "il giorno stesso vale");
  assert.equal(nextOccurrence("2025-06-10", biennial, "2027-06-10", true), "2029-06-10", "dopo = strettamente dopo");
});

test("ogni N giorni e una volta sola", () => {
  assert.equal(nextOccurrence("2026-09-01", { freq: "day", interval: 3 }, "2026-09-05"), "2026-09-07");
  assert.equal(nextOccurrence("2026-09-01", null, "2026-08-30"), "2026-09-01");
  assert.equal(nextOccurrence("2026-09-01", null, "2026-09-02"), null, "evento singolo passato");
});

test("settimanale: giorni scelti e ogni 2 settimane", () => {
  const monThu: Recurrence = { freq: "week", interval: 1, byWeekday: [3, 0] };
  assert.equal(weekday("2026-09-28"), 0, "28 settembre 2026 è lunedì");
  assert.deepEqual(occurrencesBetween("2026-09-28", monThu, "2026-09-28", "2026-10-08"),
    ["2026-09-28", "2026-10-01", "2026-10-05", "2026-10-08"]);
  const everyOtherTue: Recurrence = { freq: "week", interval: 2, byWeekday: [1] };
  assert.deepEqual(occurrencesBetween("2026-09-30", everyOtherTue, "2026-09-01", "2026-10-31"),
    ["2026-10-13", "2026-10-27"], "parte dalla settimana della data iniziale, mai prima di essa");
  assert.equal(nextOccurrence("2026-09-28", { freq: "week", interval: 1 }, "2026-10-01"), "2026-10-05", "senza giorni: lo stesso giorno della settimana");
});

test("anticipi di una scadenza: 30 e 7 giorni prima e il giorno stesso", () => {
  assert.deepEqual(notifyDates("2026-10-15", [0, 30, 7, 7]), ["2026-09-15", "2026-10-08", "2026-10-15"]);
});

test("fuso orario: le 8:00 restano le 8:00 a cavallo dell'ora legale", () => {
  assert.equal(zonedInstant("2026-03-28", "08:00", TZ).toISOString(), "2026-03-28T07:00:00.000Z", "ora solare, UTC+1");
  assert.equal(zonedInstant("2026-03-29", "08:00", TZ).toISOString(), "2026-03-29T06:00:00.000Z", "ora legale, UTC+2");
  assert.equal(zonedInstant("2026-10-25", "08:00", TZ).toISOString(), "2026-10-25T07:00:00.000Z", "torna l'ora solare");
  assert.equal(zonedDate(new Date("2026-09-25T22:30:00Z"), TZ), "2026-09-26", "alle 00:30 in Italia è già domani");
});

test("prossimo promemoria: oggi se l'ora non è passata, altrimenti la prossima occorrenza", () => {
  const daily: Recurrence = { freq: "day", interval: 1 };
  const now = new Date("2026-09-25T16:00:00Z"); // 18:00 in Italia
  assert.equal(nextReminderAt("2026-09-01", "18:30", daily, now, TZ)?.toISOString(), "2026-09-25T16:30:00.000Z");
  assert.equal(nextReminderAt("2026-09-01", "07:15", daily, now, TZ)?.toISOString(), "2026-09-26T05:15:00.000Z");
  assert.equal(nextReminderAt("2026-09-25", "07:15", null, now, TZ), null, "una volta sola, già passato");
  assert.equal(nextReminderAt("2026-10-01", "09:00", null, now, TZ)?.toISOString(), "2026-10-01T07:00:00.000Z");
});

test("describe: in italiano", () => {
  assert.equal(describe(null), "Una volta");
  assert.equal(describe({ freq: "day", interval: 1 }), "Ogni giorno");
  assert.equal(describe({ freq: "week", interval: 2, byWeekday: [3, 0] }), "Ogni 2 settimane: lun, gio");
  assert.equal(describe({ freq: "month", interval: 3 }), "Ogni 3 mesi");
  assert.equal(describe({ freq: "year", interval: 1 }), "Ogni anno");
});
