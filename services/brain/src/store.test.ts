import { test } from "node:test";
import assert from "node:assert/strict";
import { Store } from "./store.ts";

const hid = "h";
const row = (id: string, updated_at: string, extra = {}) => ({ id, household_id: hid, name: id, category: "altro", checked: false, position: 0, updated_at, deleted_at: null, ...extra });

test("una modifica locale cambia subito la copia e va in coda", () => {
  const s = new Store();
  s.change([{ table: "shopping_items", kind: "insert", itemId: "a", row: { id: "a", household_id: hid, name: "Latte" } }]);
  assert.equal(s.live("shopping_items")[0]!.name, "Latte");
  assert.equal(s.live("shopping_items")[0]!.checked, false, "i campi del server ci sono già");
  assert.equal(s.queue().length, 1);
});

test("le righe del server: vince la più recente, le modifiche in coda restano sopra, la cancellazione vince", () => {
  const s = new Store();
  s.receive("shopping_items", [row("a", "2026-09-28T10:00:00Z")]);
  s.change([{ table: "shopping_items", kind: "update", itemId: "a", patch: { checked: true } }]);
  s.receive("shopping_items", [row("a", "2026-09-28T10:05:00Z", { name: "Latte intero" })]);
  assert.deepEqual([s.row("shopping_items", "a")!.name, s.row("shopping_items", "a")!.checked], ["Latte intero", true]);
  s.receive("shopping_items", [row("a", "2026-09-28T10:01:00Z", { name: "Vecchio" })]);
  assert.equal(s.row("shopping_items", "a")!.name, "Latte intero", "un arrivo fuori ordine non torna indietro");
  s.receive("shopping_items", [row("a", "2026-09-28T10:06:00Z", { deleted_at: "2026-09-28T10:06:00Z" })]);
  assert.equal(s.row("shopping_items", "a"), undefined);
  assert.equal(s.queue().length, 0, "la modifica in coda su una riga cancellata non serve più");
});

test("dopo l'invio la coda si svuota; un doppione rifiutato sparisce anche in locale", () => {
  const s = new Store();
  s.change([
    { table: "shopping_items", kind: "insert", itemId: "a", row: { id: "a", household_id: hid, name: "Latte" } },
    { table: "shopping_items", kind: "insert", itemId: "b", row: { id: "b", household_id: hid, name: "latte" } },
  ]);
  const [a, b] = s.queue();
  s.sent({ sent: [a!, b!], duplicates: ["b"], errors: [], stopped: false });
  assert.equal(s.queue().length, 0);
  assert.deepEqual(s.live("shopping_items").map((r) => r.id), ["a"]);
});

test("scollegato dalla casa: via i dati, resta la sessione", () => {
  const s = new Store();
  s.set("auth:sb-token", "x");
  s.set("household", { id: hid });
  s.receive("notes", [{ id: "n", household_id: hid, body: "x", updated_at: "2026-01-01T00:00:00Z", deleted_at: null }]);
  s.forget();
  assert.equal(s.get("auth:sb-token"), "x");
  assert.equal(s.get("household"), null);
  assert.equal(s.all("notes").length, 0);
});
