import { test } from "node:test";
import assert from "node:assert/strict";
import { expressionFor, type TvMood } from "./expression.ts";

const calm: TvMood = { night: false, justAdded: false, daysLeft: [30], shoppingCount: 2 };

test("priorità: notte > nuovo elemento > superata > vicina > lista vuota > neutro", () => {
  assert.equal(expressionFor({ ...calm, night: true, justAdded: true, daysLeft: [-1] }), "sleepy");
  assert.equal(expressionFor({ ...calm, justAdded: true, daysLeft: [-1] }), "surprised");
  assert.equal(expressionFor({ ...calm, daysLeft: [2, -1] }), "nervous");
  assert.equal(expressionFor({ ...calm, daysLeft: [30, 3] }), "worried");
  assert.equal(expressionFor({ ...calm, daysLeft: [0] }), "worried");
  assert.equal(expressionFor({ ...calm, shoppingCount: 0 }), "happy");
  assert.equal(expressionFor(calm), "neutral");
});

test("scadenza a 4 giorni non preoccupa; senza scadenze conta la lista", () => {
  assert.equal(expressionFor({ ...calm, daysLeft: [4] }), "neutral");
  assert.equal(expressionFor({ ...calm, daysLeft: [], shoppingCount: 0 }), "happy");
});
