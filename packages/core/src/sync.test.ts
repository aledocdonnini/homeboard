import { test } from "node:test";
import assert from "node:assert/strict";
import { applyOp, classify, compact, flush, isNewer, obsolete, rebase, type Entry, type Op, type SendResult } from "./sync.ts";
import type { Item } from "./items.ts";

const H = "casa";
const remote = (over: Partial<Item> = {}): Item => ({
  id: "latte", household_id: H, name: "Latte", category: "latticini", checked: false, position: 0,
  updated_at: "2026-09-26T10:00:00+00:00", deleted_at: null, ...over,
});
const insert = (id: string, name = id): Op => ({ kind: "insert", itemId: id, row: { id, household_id: H, name, category: "altro", position: 0 } });
const update = (id: string, patch: Extract<Op, { kind: "update" }>["patch"]): Op => ({ kind: "update", itemId: id, patch });
const entries = (...ops: Op[]): Entry[] => ops.map((op, i) => ({ seq: i + 1, op }));

test("applyOp: l'inserimento crea una riga locale che il server sostituirà", () => {
  const row = applyOp(undefined, insert("pane", "Pane"))!;
  assert.equal(row.name, "Pane");
  assert.equal(row.checked, false);
  assert.equal(row.updated_at, "1970-01-01T00:00:00Z");
  assert.equal(applyOp(undefined, update("x", { checked: true })), undefined, "update su riga sconosciuta: niente");
});

test("rebase: la riga del server riceve le modifiche ancora in coda", () => {
  const pending = [update("latte", { checked: true }), update("uova", { checked: true }), update("latte", { category: "colazione" })];
  const row = rebase(remote({ name: "Latte intero" }), pending);
  assert.equal(row.checked, true, "la mia spunta resta visibile finché non parte");
  assert.equal(row.category, "colazione");
  assert.equal(row.name, "Latte intero", "i campi che non ho toccato vengono dal server");
});

test("rebase: la cancellazione del server vince sulle modifiche locali", () => {
  const row = rebase(remote({ deleted_at: "2026-09-26T10:05:00+00:00" }), [update("latte", { checked: false })]);
  assert.ok(row.deleted_at);
  assert.equal(row.checked, false);
});

test("compact: modifiche consecutive alla stessa riga diventano una, dentro l'inserimento se non è partito", () => {
  const out = compact(entries(
    insert("pane", "Pane"),
    update("latte", { checked: true }),
    update("pane", { checked: true }),
    update("latte", { checked: false }),
    update("pane", { deleted_at: "2026-09-26T11:00:00Z" }),
  ));
  assert.equal(out.length, 2);
  assert.deepEqual(out[0], { seq: 5, op: { ...insert("pane", "Pane"), row: { ...(insert("pane", "Pane") as Extract<Op, { kind: "insert" }>).row, checked: true, deleted_at: "2026-09-26T11:00:00Z" } } });
  assert.deepEqual(out[1], { seq: 4, op: update("latte", { checked: false }) }, "vince l'ultimo valore, non un'inversione");
});

test("obsolete: le modifiche in coda su righe cancellate dal server si buttano", () => {
  const queue = entries(update("latte", { checked: true }), insert("pane"), update("uova", { checked: true }));
  assert.deepEqual(obsolete(queue, new Set(["latte"])).map((e) => e.seq), [1]);
});

test("flush: invia in ordine e si ferma al primo errore di rete, senza perdere niente", async () => {
  const sent: string[] = [];
  const results: Record<string, SendResult> = { a: "ok", b: "retry", c: "ok" };
  const report = await flush(entries(insert("a"), insert("b"), insert("c")), async (op) => {
    sent.push(op.itemId);
    return results[op.itemId]!;
  });
  assert.deepEqual(sent, ["a", "b"], "c non parte finché b non è passato");
  assert.deepEqual(report.sent.map((e) => e.op.itemId), ["a"]);
  assert.equal(report.stopped, true);
});

test("flush: duplicati e rifiuti si tolgono dalla coda (non si riprova all'infinito)", async () => {
  const results: Record<string, SendResult> = { dup: "duplicate", bad: { error: "permesso negato" }, ok: "ok" };
  const report = await flush(entries(insert("dup"), insert("bad"), insert("ok")), async (op) => results[op.itemId]!);
  assert.deepEqual(report.sent.map((e) => e.op.itemId), ["dup", "bad", "ok"]);
  assert.deepEqual(report.duplicates, ["dup"]);
  assert.deepEqual(report.errors.map((e) => e.error), ["permesso negato"]);
  assert.equal(report.stopped, false);
});

test("classify: rete, invio già arrivato, duplicato, rifiuto", () => {
  assert.equal(classify(null, 201), "ok");
  assert.equal(classify({ message: "TypeError: Failed to fetch" }, 0), "retry");
  assert.equal(classify({ code: "XX000", message: "server" }, 503), "retry");
  assert.equal(classify({ code: "PGRST301", message: "JWT expired" }, 401), "retry");
  assert.equal(classify({ code: "23505", message: 'duplicate key value violates unique constraint "shopping_items_pkey"' }, 409), "ok");
  assert.equal(classify({ code: "23505", message: 'duplicate key value violates unique constraint "shopping_items_live_name"' }, 409), "duplicate");
  assert.deepEqual(classify({ code: "42501", message: "new row violates row-level security policy" }, 403), { error: "new row violates row-level security policy" });
});

test("isNewer: confronta gli orari del server a prescindere dal formato", () => {
  const local = remote({ updated_at: "2026-09-26T10:00:05.000000+00:00" });
  assert.equal(isNewer(local, remote({ updated_at: "2026-09-26T10:00:01+00:00" })), true, "fetch lenta arrivata dopo il realtime");
  assert.equal(isNewer(local, remote({ updated_at: "2026-09-26 10:00:09+00" })), false);
  assert.equal(isNewer(remote({ updated_at: "1970-01-01T00:00:00Z" }), remote()), false, "le righe locali perdono sempre");
  assert.equal(isNewer(undefined, remote()), false);
});
