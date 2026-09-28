import { test } from "node:test";
import assert from "node:assert/strict";
import { countdown, secondsLeft, spoken } from "./timers.ts";

test("conto alla rovescia", () => {
  const now = new Date("2026-09-28T10:00:00Z");
  assert.equal(secondsLeft("2026-09-28T10:10:05Z", now), 605);
  assert.equal(secondsLeft("2026-09-28T09:59:00Z", now), 0);
  assert.equal(secondsLeft("2026-09-28T10:00:00.200Z", now), 1);
  assert.equal(countdown(605), "10:05");
  assert.equal(countdown(3725), "1:02:05");
  assert.equal(countdown(0), "00:00");
  assert.equal(spoken(581), "9 minuti e 41 secondi");
  assert.equal(spoken(3720), "1 ora e 2 minuti");
  assert.equal(spoken(60), "1 minuto");
  assert.equal(spoken(0), "meno di un secondo");
});
