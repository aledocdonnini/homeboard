import { test } from "node:test";
import assert from "node:assert/strict";
import { answerFromNotes, interpret, llmFallback, llmFromEnv } from "./index.ts";

const ctx = { now: new Date("2026-09-28T08:00:00Z"), timezone: "Europe/Rome", timers: ["pasta"] };
type Call = { url: string; body: { model: string; messages: { role: string; content: string }[]; response_format: unknown }; auth?: string };

/** Un fetch finto che risponde `content` come farebbe /chat/completions, e ricorda cosa gli è stato chiesto. */
function fake(content: string | Error, status = 200) {
  const calls: Call[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)), auth: (init.headers as Record<string, string>).Authorization });
    if (content instanceof Error) throw content;
    return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

test("configurazione dalle variabili d'ambiente", () => {
  assert.equal(llmFromEnv({}), null);
  assert.equal(llmFromEnv({ ROBY_LLM: "none" }), null);
  const ollama = llmFromEnv({ ROBY_LLM: "ollama" })!;
  assert.deepEqual([ollama.url, ollama.local, ollama.notes], ["http://127.0.0.1:11434/v1", true, true]);
  const groq = llmFromEnv({ ROBY_LLM: "groq", ROBY_LLM_KEY: "k" })!;
  assert.deepEqual([groq.local, groq.notes], [false, false], "le note non vanno in cloud senza permesso");
  assert.equal(llmFromEnv({ ROBY_LLM: "gemini", ROBY_LLM_KEY: "k", ROBY_LLM_NOTES: "sì" })!.notes, true);
  assert.equal(llmFromEnv({ ROBY_LLM: "ollama", ROBY_LLM_URL: "http://192.168.1.20:11434/v1" })!.local, true, "Ollama su un altro computer di casa");
  assert.throws(() => llmFromEnv({ ROBY_LLM: "groq" }), /ROBY_LLM_KEY/);
  assert.throws(() => llmFromEnv({ ROBY_LLM: "boh" }), /sconosciuto/);
});

test("il ripiego chiede JSON e il risultato passa dallo schema", async () => {
  const cfg = llmFromEnv({ ROBY_LLM: "groq", ROBY_LLM_KEY: "segreta" })!;
  const { fetchImpl, calls } = fake('{"type":"shopping.add","items":["Farina di riso"]}');
  const r = await interpret("stasera finisce la farina di riso, pensaci tu", ctx, llmFallback(cfg, fetchImpl));
  assert.deepEqual(r, { intent: { type: "shopping.add", items: ["Farina di riso"] }, by: "groq:llama-3.1-8b-instant" });
  assert.equal(calls[0]!.url, "https://api.groq.com/openai/v1/chat/completions");
  assert.equal(calls[0]!.auth, "Bearer segreta");
  assert.deepEqual(calls[0]!.body.response_format, { type: "json_object" });
  const system = calls[0]!.body.messages[0]!.content;
  assert.match(system, /lunedì 2026-09-28, sono le 10:00/);
  assert.match(system, /Timer attivi: pasta/);
  assert.match(system, /"shopping\.add"/, "lo schema degli intenti è nel prompt");
});

test("le frasi capite dalle regole non vanno al modello", async () => {
  const cfg = llmFromEnv({ ROBY_LLM: "ollama" })!;
  const { fetchImpl, calls } = fake("{}");
  const r = await interpret("aggiungi il latte", ctx, llmFallback(cfg, fetchImpl));
  assert.equal(r.by, "rules");
  assert.equal(calls.length, 0);
});

test("risposte sbagliate, errori e tempo scaduto: resta non capita", async () => {
  const cfg = llmFromEnv({ ROBY_LLM: "ollama" })!;
  for (const f of [fake('{"type":"cancella_tutto"}'), fake("non è json"), fake(new Error("timeout")), fake("{}", 500)]) {
    const r = await interpret("boh boh", ctx, llmFallback(cfg, f.fetchImpl));
    assert.deepEqual(r, { intent: { type: "unknown", text: "boh boh" }, by: "rules" });
  }
});

test("risposta dalle note: solo se c'è, con la nota usata", async () => {
  const cfg = llmFromEnv({ ROBY_LLM: "ollama" })!;
  const notes = [{ body: "Le batterie sono nel cassetto della cucina", date: "28 settembre" }, { body: "Il codice del cancello è 4512", date: "3 marzo" }];
  const ok = fake('{"risposta":"Sono nel cassetto della cucina.","nota":1}');
  assert.deepEqual(await answerFromNotes(cfg, "dove sono le pile?", notes, ok.fetchImpl), { text: "Sono nel cassetto della cucina.", note: 0 });
  assert.match(ok.calls[0]!.body.messages[0]!.content, /1\. \(28 settembre\) Le batterie/);
  assert.equal(await answerFromNotes(cfg, "dove ho messo il caricabatterie?", notes, fake('{"risposta":null,"nota":null}').fetchImpl), null);
  assert.equal(await answerFromNotes(cfg, "x", notes, fake('{"risposta":"inventata","nota":7}').fetchImpl), null, "una nota che non esiste");
});
