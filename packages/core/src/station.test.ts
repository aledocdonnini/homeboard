import { test } from "node:test";
import assert from "node:assert/strict";
import type { HomeState } from "./protocol.ts";
import { faceFor, isNight, pickPanel } from "./station.ts";

// Lunedì 28 settembre 2026, 10:00 a Roma.
const now = new Date("2026-09-28T08:00:00Z");
const base: HomeState = {
  household: { name: "Casa", timezone: "Europe/Rome", nightStart: "23:30", nightEnd: "07:00" },
  pairing: null, online: true, mic: "on", activity: "idle",
  timers: [], answer: null, shopping: ["Latte"], reminders: [], deadlines: [], arrivedAt: null,
};
const at = (ms: number) => new Date(now.getTime() + ms).toISOString();
const pasta = { id: "p", label: "pasta", durationS: 600, endsAt: at(300_000), status: "running" as const };
const answer = { id: "a", said: "cosa manca", reply: "Latte.", panel: { kind: "shopping" as const, items: ["Latte"] }, at: at(-10_000) };

test("la notte scavalca la mezzanotte", () => {
  assert.equal(isNight("23:45", "23:30", "07:00"), true);
  assert.equal(isNight("06:59", "23:30", "07:00"), true);
  assert.equal(isNight("07:00", "23:30", "07:00"), false);
  assert.equal(isNight("14:00", "13:00", "15:00"), true);
});

test("priorità del pannello centrale", () => {
  const kind = (s: Partial<HomeState>, when = now) => pickPanel({ ...base, ...s }, when).kind;
  assert.equal(kind({ household: null }), "pairing");
  assert.equal(kind({}), "idle");
  assert.equal(kind({ timers: [{ ...pasta, status: "ringing" }], answer }), "ringing", "un timer che suona vince su tutto");
  assert.equal(kind({ timers: [pasta], answer }), "answer", "la risposta appena data vince sui timer");
  assert.equal(kind({ timers: [pasta], answer: { ...answer, at: at(-31_000) } }), "timers", "dopo 30 secondi la risposta sparisce");
  assert.equal(kind({ reminders: [{ title: "Dentista", at: at(45 * 60_000) }] }), "soon");
  assert.equal(kind({ reminders: [{ title: "Dentista", at: at(90 * 60_000) }] }), "idle", "fra un'ora e mezza non è ancora imminente");
  assert.equal(kind({ deadlines: [{ title: "Bollo", due: "2026-10-01" }] }), "soon");
  assert.equal(kind({ deadlines: [{ title: "Bollo", due: "2026-10-02" }] }), "idle");
  assert.equal(kind({ deadlines: [{ title: "Multa", due: "2026-09-20" }] }), "soon", "anche le scadenze superate");
});

test("di notte: fine delle trasmissioni, ma non se si parla con Roby o suona un timer", () => {
  const night = new Date("2026-09-28T22:00:00Z"); // mezzanotte a Roma
  const kind = (s: Partial<HomeState>) => pickPanel({ ...base, ...s }, night).kind;
  assert.equal(kind({ timers: [{ ...pasta, endsAt: new Date(night.getTime() + 60_000).toISOString() }] }), "night");
  assert.equal(kind({ activity: "listening" }), "idle");
  assert.equal(kind({ timers: [{ ...pasta, status: "ringing" }] }), "ringing");
  assert.equal(kind({ answer: { ...answer, at: night.toISOString() } }), "answer");
});

test("il soon porta il promemoria più vicino e la scadenza più urgente", () => {
  const p = pickPanel({ ...base,
    reminders: [{ title: "Dopo", at: at(50 * 60_000) }, { title: "Prima", at: at(20 * 60_000) }],
    deadlines: [{ title: "Bollo", due: "2026-09-30" }, { title: "Multa", due: "2026-09-27" }] }, now);
  assert.deepEqual(p, { kind: "soon", soon: {
    reminder: { title: "Prima", at: at(20 * 60_000), minutes: 20 },
    deadline: { title: "Multa", due: "2026-09-27", daysLeft: -1 },
  } });
});

test("la faccia di Roby", () => {
  const face = (s: Partial<HomeState>, when = now) => {
    const st = { ...base, ...s };
    return faceFor(st, pickPanel(st, when), when);
  };
  assert.deepEqual(face({ activity: "listening" }), { expression: "listening", mode: "listening" });
  assert.deepEqual(face({ activity: "thinking" }), { expression: "thinking", mode: "idle" });
  assert.deepEqual(face({ activity: "speaking", shopping: [] }), { expression: "happy", mode: "talking" });
  assert.equal(face({}, new Date("2026-09-28T22:00:00Z")).expression, "sleepy");
  assert.equal(face({ timers: [{ ...pasta, status: "ringing" }] }).expression, "excited");
  assert.equal(face({ arrivedAt: at(-2000) }).expression, "surprised");
  assert.equal(face({ arrivedAt: at(-6000) }).expression, "neutral");
  assert.equal(face({ deadlines: [{ title: "Multa", due: "2026-09-27" }] }).expression, "nervous");
  assert.equal(face({ deadlines: [{ title: "Bollo", due: "2026-09-30" }] }).expression, "worried");
  assert.equal(face({ shopping: [] }).expression, "happy");
});
