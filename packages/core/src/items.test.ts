import { test } from "node:test";
import assert from "node:assert/strict";
import { arrange, guessCategory, parseQuickAdd, positionBetween, suggest, type Item, type Stat } from "./items.ts";

const item = (over: Partial<Item>): Item => ({
  id: "1", household_id: "h", name: "Latte", category: "latticini", checked: false, position: 0,
  updated_at: "2026-09-26T10:00:00.000000+00:00", deleted_at: null, ...over,
});

test("aggiunta rapida: separa su virgole e a capo, non su 'e'", () => {
  assert.deepEqual(parseQuickAdd(" latte,  uova ;\npane   integrale,, "), ["Latte", "Uova", "Pane integrale"]);
  assert.deepEqual(parseQuickAdd("sale e pepe"), ["Sale e pepe"]);
  assert.deepEqual(parseQuickAdd(" , "), []);
});

test("reparto: prima la storia della casa, poi le parole chiave", () => {
  const stats: Stat[] = [{ name_norm: "latte", name: "Latte", category: "colazione", uses: 3 }];
  assert.equal(guessCategory(" LATTE ", stats), "colazione");
  assert.equal(guessCategory("Latte"), "latticini");
  assert.equal(guessCategory("Mele golden"), "frutta-verdura");
  assert.equal(guessCategory("Salmone affumicato"), "carne-pesce");
  assert.equal(guessCategory("Sale grosso"), "dispensa");
  assert.equal(guessCategory("Carta igienica"), "casa");
  assert.equal(guessCategory("Lampadina"), "altro");
});

test("suggerimenti: più usati, per inizio di parola, esclusi quelli in lista", () => {
  const stats: Stat[] = [
    { name_norm: "pane", name: "Pane", category: "pane", uses: 9 },
    { name_norm: "panna", name: "Panna", category: "latticini", uses: 2 },
    { name_norm: "latte di soia", name: "Latte di soia", category: "latticini", uses: 5 },
  ];
  assert.deepEqual(suggest(stats, "pa", new Set(["pane"])).map((s) => s.name), ["Panna"]);
  assert.deepEqual(suggest(stats, "soia", new Set()).map((s) => s.name), ["Latte di soia"]);
  assert.deepEqual(suggest(stats, "", new Set()).map((s) => s.name), ["Pane", "Latte di soia", "Panna"]);
});

test("posizioni frazionarie", () => {
  assert.equal(positionBetween(), 0);
  assert.equal(positionBetween(undefined, 3), 2);
  assert.equal(positionBetween(3), 4);
  assert.equal(positionBetween(1, 2), 1.5);
});

test("arrange: reparti in ordine di supermercato, spuntati a parte, tombstone fuori", () => {
  const { groups, checked } = arrange([
    item({ id: "a", name: "Detersivo", category: "casa" }),
    item({ id: "b", name: "Mele", category: "frutta-verdura", position: 2 }),
    item({ id: "c", name: "Pere", category: "frutta-verdura", position: 1 }),
    item({ id: "d", name: "Latte", checked: true, updated_at: "2026-09-26T11:00:00Z" }),
    item({ id: "e", name: "Uova", checked: true, updated_at: "2026-09-26T12:00:00Z" }),
    item({ id: "f", name: "Pane", category: "pane", deleted_at: "2026-09-26T12:00:00Z" }),
  ]);
  assert.deepEqual(groups.map((g) => [g.label, g.items.map((i) => i.name)]), [
    ["Frutta e verdura", ["Pere", "Mele"]],
    ["Casa e igiene", ["Detersivo"]],
  ]);
  assert.deepEqual(checked.map((i) => i.name), ["Uova", "Latte"]);
});

