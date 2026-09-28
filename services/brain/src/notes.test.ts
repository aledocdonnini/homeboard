import { test } from "node:test";
import assert from "node:assert/strict";
import { cite, index, search, type Embedder } from "./notes.ts";
import { Store } from "./store.ts";

// Un embedder finto: ogni testo diventa il vettore delle "idee" che contiene (sinonimi compresi), normalizzato;
// un testo senza nessuna di queste idee finisce tutto sull'ultima dimensione, "altro".
const IDEAS = [["chiave", "chiavi"], ["pile", "batterie"], ["cancello"], ["filtro", "caldaia"]];
const fake: Embedder = {
  async embed(texts) {
    return texts.map((t) => {
      const v = IDEAS.map((words) => (words.some((w) => t.toLowerCase().includes(w)) ? 1 : 0));
      v.push(v.some(Boolean) ? 0 : 1);
      const norm = Math.hypot(...v);
      return v.map((x) => x / norm);
    });
  },
};

const note = (id: string, body: string, created_at = "2026-09-28T08:00:00Z", source = "voce") =>
  ({ id, household_id: "h", body, source, created_at, updated_at: created_at, deleted_at: null });

test("indicizza una volta sola, e di nuovo se cambia il testo", async () => {
  const store = new Store();
  store.receive("notes", [note("a", "Le batterie sono nel cassetto"), note("b", "Il codice del cancello è 4512")]);
  assert.equal(await index(store, fake), 2);
  assert.equal(await index(store, fake), 0);
  assert.equal(store.queue().filter((e) => e.op.kind === "update" && "embedding" in e.op.patch).length, 2, "gli embedding vanno anche su Supabase");
  store.receive("notes", [note("b", "Il codice del cancello è 9999", "2026-09-28T09:00:00Z")]);
  assert.equal(await index(store, fake), 1);
});

test("trova per significato, e dice di non sapere sotto la soglia", async () => {
  const store = new Store();
  store.receive("notes", [note("a", "Le batterie sono nel cassetto"), note("b", "Il codice del cancello è 4512")]);
  await index(store, fake);
  assert.equal((await search(store, "dove sono le pile?", fake))?.note.id, "a");
  assert.equal((await search(store, "che tempo fa domani?", fake)), null);
});

test("senza modello cerca per parole", async () => {
  const store = new Store();
  store.receive("notes", [note("a", "Le batterie sono nel cassetto"), note("b", "Il codice del cancello è 4512")]);
  assert.equal((await search(store, "qual è il codice del cancello?", null))?.note.id, "b");
  assert.equal(await search(store, "dove sono le pile?", null), null, "i sinonimi li capisce solo il modello");
});

test("la risposta cita data e origine", () => {
  const now = new Date("2026-09-28T15:00:00Z");
  assert.equal(cite(note("a", "La chiave di scorta è da mia madre"), now, "Europe/Rome"), "Oggi mi hai detto: la chiave di scorta è da mia madre.");
  assert.equal(cite(note("a", "Ho cambiato il filtro.", "2026-09-27T10:00:00Z", "pwa"), now, "Europe/Rome"), "Ieri hai scritto: ho cambiato il filtro.");
  assert.equal(cite(note("a", "Garanzia lavatrice", "2026-03-12T10:00:00Z", "share"), now, "Europe/Rome"), "Il 12 marzo hai salvato: garanzia lavatrice.");
  assert.equal(cite(note("a", "Tagliando a 45000 km", "2025-11-02T10:00:00Z"), now, "Europe/Rome"), "Il 2 novembre 2025 mi hai detto: tagliando a 45000 km.");
});

test("una domanda libera non capita trova la risposta nelle note", async () => {
  const { execute } = await import("./executor.ts");
  const { Timers } = await import("./timers.ts");
  const { parse } = await import("@homeboard/intents");
  const store = new Store();
  store.receive("notes", [note("a", "Le batterie sono nel cassetto")]);
  await index(store, fake);
  const now = new Date("2026-09-28T15:00:00Z");
  const ctx = { store, timers: new Timers(store), householdId: "h", timezone: "Europe/Rome", now, embedder: fake };
  const r = await execute(parse("per il telecomando che batterie avevamo preso", { now, timezone: "Europe/Rome" }), ctx);
  assert.equal(r.reply, "Oggi mi hai detto: le batterie sono nel cassetto.");
  const miss = await execute(parse("fai il caffè", { now, timezone: "Europe/Rome" }), ctx);
  assert.equal(miss.reply, "Scusa, non ho capito.");
});

test("con un modello linguistico: risponde con parole sue, dalla nota, e dice da dove viene", async () => {
  const { execute } = await import("./executor.ts");
  const { Timers } = await import("./timers.ts");
  const { llmFromEnv } = await import("@homeboard/intents");
  const store = new Store();
  store.receive("notes", [note("a", "Le batterie sono nel cassetto della cucina", "2026-09-28T08:00:00Z", "pwa")]);
  await index(store, fake);
  const now = new Date("2026-09-28T15:00:00Z");
  const ctx = { store, timers: new Timers(store), householdId: "h", timezone: "Europe/Rome", now, embedder: fake, llm: llmFromEnv({ ROBY_LLM: "ollama" }) };
  const ask = { type: "note.ask" as const, question: "Dove sono le pile" };
  const real = globalThis.fetch;
  const answer = (content: string | null) => {
    globalThis.fetch = (async () => {
      if (content === null) throw new Error("Ollama spento");
      return new Response(JSON.stringify({ choices: [{ message: { content } }] }));
    }) as unknown as typeof fetch;
  };
  try {
    answer('{"risposta":"Sono nel cassetto della cucina.","nota":1}');
    assert.equal((await execute(ask, ctx)).reply, "Sono nel cassetto della cucina. L'hai scritto oggi.");
    answer('{"risposta":null,"nota":null}');
    assert.equal((await execute(ask, ctx)).reply, "Non ho niente annotato su questo.", "il modello dice che la risposta non c'è");
    answer(null);
    assert.equal((await execute(ask, ctx)).reply, "Oggi hai scritto: le batterie sono nel cassetto della cucina.", "modello irraggiungibile: si legge la nota");
  } finally {
    globalThis.fetch = real;
  }
});
