import { test } from "node:test";
import assert from "node:assert/strict";
import { interpret, type Fallback } from "./index.ts";

const ctx = { now: new Date("2026-09-28T10:00:00Z"), timezone: "Europe/Rome" };
const model = (answer: () => unknown): Fallback => ({ name: "finto", interpret: async () => answer() });

test("il ripiego vale solo se restituisce un intento valido", async () => {
  const ok = await interpret("mi manca il latte", ctx, model(() => ({ type: "shopping.add", items: ["latte"] })));
  assert.deepEqual(ok, { intent: { type: "shopping.add", items: ["latte"] }, by: "finto" });

  const invalid = await interpret("boh", ctx, model(() => ({ type: "shopping.add", items: [] })));
  assert.equal(invalid.intent.type, "unknown");

  const invented = await interpret("boh", ctx, model(() => ({ type: "rm -rf" })));
  assert.equal(invented.intent.type, "unknown");

  const down = await interpret("boh", ctx, model(() => { throw new Error("offline"); }));
  assert.deepEqual(down, { intent: { type: "unknown", text: "boh" }, by: "rules" });
});
