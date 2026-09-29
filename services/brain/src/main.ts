// brain: il cervello della postazione di casa. Vedi services/brain/README.md.
//
//   voice ──socket Unix (JSON a righe)──▶ brain ──ws://127.0.0.1:8765──▶ /casa
//                                          │
//                                SQLite (copia locale + coda) ⇄ Supabase
//
// Senza voice (sul Mac, per provare) le frasi si scrivono nel terminale, una per riga.

import { existsSync, mkdirSync, rmSync } from "node:fs";
import { createServer, type Socket } from "node:net";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { WebSocketServer, type WebSocket } from "ws";
import type { AnswerPanel, BrainToVoice, ToHome, VoiceToBrain } from "@homeboard/core/protocol";
import { DESTRUCTIVE, interpret, llmFallback, llmFromEnv, type Intent, type LlmConfig } from "@homeboard/intents";
import { isNight } from "@homeboard/core/station";
import { Cloud } from "./cloud.ts";
import { execute, openDeadlines } from "./executor.ts";
import { dueBetween, homeState, type Household, type Live } from "./state.ts";
import { Store } from "./store.ts";
import { Timers } from "./timers.ts";
import { index, loadEmbedder, type Embedder } from "./notes.ts";
import { Music } from "./music.ts";

// ——— Configurazione (variabili d'ambiente, o services/brain/.env) ———
if (existsSync(".env")) process.loadEnvFile(".env");
const env = (k: string, fallback?: string) => {
  const v = process.env[k] ?? fallback;
  if (v === undefined) throw new Error(`Manca ${k}: vedi services/brain/.env.example`);
  return v;
};
const DB_PATH = env("BRAIN_DB", join(process.env.XDG_DATA_HOME ?? join(homedir(), ".local/share"), "roby/brain.db"));
const PORT = Number(env("BRAIN_PORT", "8765"));
const VOICE_SOCKET = env("VOICE_SOCKET", join(process.env.XDG_RUNTIME_DIR ?? "/tmp", "roby.sock"));
/**
 * Di notte il pannello è spento, e con lui l'audio HDMI: prima di parlare lo si riaccende per un po'.
 * Il comando lo imposta homeboard-brain.service (device/bin/screen.sh wake); sul Mac non c'è.
 */
const SCREEN_WAKE = process.env.SCREEN_WAKE_CMD;
/** Il modello linguistico, se configurato (ROBY_LLM): ripiego per le frasi non capite e risposte dalle note. */
let llm: LlmConfig | null = null;
try {
  llm = llmFromEnv(process.env);
  if (llm) console.log(`Modello linguistico: ${llm.provider} (${llm.model}), note ${llm.notes ? "sì" : "no"}${llm.local ? ", in locale" : ""}`);
} catch (e) {
  console.warn(`ROBY_LLM ignorato: ${(e as Error).message}`);
}
const fallback = llm ? llmFallback(llm) : undefined;
/** Dopo "Confermi?" si aspetta un sì o un no per 20 secondi, poi si lascia perdere. */
const CONFIRM_MS = 20_000;

mkdirSync(dirname(DB_PATH), { recursive: true });
const store = new Store(DB_PATH);
const timers = new Timers(store);
const live: Live = { online: false, mic: "on", activity: "idle", answer: null, arrivedAt: null, pairing: null };
const music = new Music();
let pending: { intent: Intent; until: number } | null = null;

// ——— /casa ———
const screens = new Set<WebSocket>();
const wss = new WebSocketServer({ host: "127.0.0.1", port: PORT });
const toScreens = (msg: ToHome) => { const s = JSON.stringify(msg); for (const c of screens) c.send(s); };
let queued = false;
/** Si ridisegna al massimo una volta per giro dell'event loop, anche se cambiano tante cose insieme. */
function redraw() {
  if (queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    live.online = cloud.online;
    live.pairing = cloud.pairing;
    live.music = music.now;
    live.musicLink = music.link;
    toScreens({ type: "state", state: homeState(store, timers, live, new Date()) });
  });
}
wss.on("connection", (ws) => {
  screens.add(ws);
  ws.on("close", () => screens.delete(ws));
  redraw();
});

// ——— voice ———
let voice: Socket | null = null;
const toVoice = (msg: BrainToVoice) => voice?.write(`${JSON.stringify(msg)}\n`);
function say(text: string, listen = false) {
  console.log(`🗣  ${text}`);
  if (!voice) return; // sul Mac senza voice: resta il testo sullo schermo
  toVoice({ type: "say", id: randomUUID(), text, ...(listen ? { listen } : {}) });
}
// Socket Unix sul Pi; tcp://host:porta per voice in Docker sul Mac (un socket Unix dell'host lì non arriva).
const tcp = VOICE_SOCKET.match(/^tcp:\/\/(.+):(\d+)$/);
if (!tcp && existsSync(VOICE_SOCKET)) rmSync(VOICE_SOCKET);
const voiceServer = createServer((socket) => {
  voice?.destroy();
  voice = socket;
  console.log("voice collegato");
  toVoice({ type: "alarm", on: timers.ringing });
  createInterface({ input: socket }).on("line", (line) => {
    try { onVoice(JSON.parse(line) as VoiceToBrain); } catch (e) { console.warn("Messaggio di voice non valido:", e); }
  });
  socket.on("close", () => {
    if (voice === socket) voice = null;
    live.activity = "idle";
    redraw();
  });
  socket.on("error", () => {});
});
if (tcp) voiceServer.listen(Number(tcp[2]), tcp[1]);
else voiceServer.listen(VOICE_SOCKET);

// La musica si abbassa quando Roby ascolta o parla, e torna su quando ha finito (con un attimo di respiro).
let restoreTimer: ReturnType<typeof setTimeout> | undefined;
function duckMusic(on: boolean) {
  clearTimeout(restoreTimer);
  if (on) void music.duck();
  else restoreTimer = setTimeout(() => { if (live.activity === "idle") void music.restore(); }, 1500);
}

function onVoice(msg: VoiceToBrain) {
  if (msg.type === "wake" || msg.type === "speaking") duckMusic(true);
  if (msg.type === "nothing" || msg.type === "spoken") duckMusic(false);
  switch (msg.type) {
    case "wake": live.activity = "listening"; wakeScreen(); break;
    case "heard": void hear(msg.text); return;
    case "nothing": live.activity = "idle"; break;
    case "speaking": live.activity = "speaking"; break;
    case "spoken": live.activity = "idle"; toScreens({ type: "level", value: null }); break;
    case "level": toScreens({ type: "level", value: msg.value }); return;
    case "mic": live.mic = msg.muted ? "muted" : "on"; break;
  }
  redraw();
}

// ——— Notte ———
function night() {
  const h = store.get<Household>("household");
  if (!h) return false;
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: h.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());
  return isNight(time, h.night_start.slice(0, 5), h.night_end.slice(0, 5));
}
function wakeScreen() {
  if (!SCREEN_WAKE || !night()) return;
  spawn("sh", ["-c", SCREEN_WAKE], { stdio: "ignore", detached: true }).unref();
}

// ——— Una frase ———
async function hear(said: string) {
  const house = store.get<Household>("household");
  if (!house) return say("Prima devo essere abbinato a una casa: il codice è sullo schermo.");
  live.activity = "thinking";
  redraw();
  const now = new Date();
  const { intent, by } = await interpret(said, {
    now, timezone: house.timezone,
    timers: timers.list.flatMap((t) => (t.label ? [t.label] : [])),
    deadlines: openDeadlines(store).map((d) => String(d.title)),
  }, fallback);
  console.log(`→ ${JSON.stringify(intent)}${by === "rules" ? "" : ` (da ${by})`}`);
  // Le regole non l'hanno capita: anche se l'ha capita il modello, finisce nel registro per migliorarle.
  if (by !== "rules") store.change([{ table: "unparsed_log", kind: "insert", itemId: randomUUID(), row: { household_id: house.id, text: said.slice(0, 500), source: "voce" } }]);

  let todo = intent;
  if (pending && pending.until > now.getTime() && (intent.type === "confirm" || intent.type === "cancel")) {
    todo = intent.type === "confirm" ? pending.intent : intent;
    pending = null;
    if (intent.type === "cancel") return answer(said, "Va bene, lascio stare.", { kind: "text" });
  } else if (DESTRUCTIVE.has(intent.type)) {
    pending = { intent, until: now.getTime() + CONFIRM_MS };
    return answer(said, "Tolgo tutto dalla lista della spesa? Dimmi sì o no.", { kind: "text" }, true);
  }
  pending = null;
  const result = await execute(todo, { store, timers, householdId: house.id, timezone: house.timezone, now, embedder, llm, music });
  answer(said, result.reply, result.panel);
  if (todo.type.startsWith("timer.")) {
    toVoice({ type: "alarm", on: timers.ringing }); // "basta": l'allarme si spegne subito
    void cloud.publishTimers(timers.list);
  }
  void cloud.sync();
}

function answer(said: string, reply: string, panel: AnswerPanel | null, listen = false) {
  live.answer = panel ? { id: randomUUID(), said, reply, panel, at: new Date().toISOString() } : null;
  if (!voice) live.activity = "idle";
  redraw();
  say(reply, listen);
}

// ——— Tempo: timer che suonano, promemoria da annunciare ———
let lastCheck = new Date();
setInterval(() => {
  const now = new Date();
  const { started, expired } = timers.tick(now);
  if (started.length || expired.length) {
    toVoice({ type: "alarm", on: timers.ringing });
    for (const t of started) console.log(`⏰ ${t.label ?? "timer"}`);
    if (started.length) wakeScreen();
    void cloud.publishTimers(timers.list);
    redraw();
  }
  if (now.getTime() - lastCheck.getTime() >= 10_000) {
    const house = store.get<Household>("household");
    if (house) {
      for (const title of dueBetween(store.live("reminders"), lastCheck, now, house.timezone)) {
        wakeScreen();
        answer("promemoria", `È ora: ${title.charAt(0).toLowerCase()}${title.slice(1)}.`, { kind: "text" });
      }
    }
    lastCheck = now;
    redraw(); // i promemoria imminenti e le risposte scadute cambiano col tempo
  }
}, 250);

// ——— Note: il modello degli embedding si carica in background (la prima volta si scarica) ———
let embedder: Embedder | null = null;
async function indexNotes() {
  if (!embedder || !store.get("household")) return;
  try {
    const n = await index(store, embedder);
    if (n) {
      console.log(`Note indicizzate: ${n}`);
      void cloud.sync();
    }
  } catch (e) {
    console.warn("Indicizzazione delle note non riuscita:", (e as Error).message);
  }
}
loadEmbedder()
  .then((e) => { embedder = e; console.log("Ricerca nelle note per significato: pronta."); void indexNotes(); })
  .catch((e) => console.warn("Modello delle note non disponibile, cerco per parole:", (e as Error).message));
setInterval(() => void indexNotes(), 30_000);

// ——— Musica: cosa suona e se va collegato l'account, ogni 3 secondi ———
setInterval(async () => { if (await music.refresh()) redraw(); }, 3000);
void music.refresh();

// ——— Supabase ———
const cloud = new Cloud(store, env("SUPABASE_URL"), env("SUPABASE_PUBLISHABLE_KEY"), {
  changed() {
    redraw();
    void indexNotes(); // note nuove o cambiate, anche dal telefono
  },
  arrived(name) {
    live.arrivedAt = new Date().toISOString();
    if (!night()) say(`In lista: ${name.charAt(0).toLowerCase()}${name.slice(1)}.`); // di notte non si sveglia nessuno
    redraw();
  },
});
void cloud.start();
let wasOnline = false;
setInterval(() => {
  if (cloud.online && !wasOnline) void cloud.publishTimers(timers.list);
  wasOnline = cloud.online;
}, 5000);

// ——— Terminale: frasi a mano, per provare senza microfono ———
if (process.stdin.isTTY || process.env.BRAIN_STDIN) {
  createInterface({ input: process.stdin }).on("line", (line) => {
    const text = line.trim();
    if (text === "/stato") console.log(JSON.stringify(homeState(store, timers, live, new Date()), null, 2));
    else if (text === "/coda") console.log(store.queue());
    else if (text) void hear(text);
  });
}

console.log(`brain: /casa su ws://127.0.0.1:${PORT}, voice su ${VOICE_SOCKET}, dati in ${DB_PATH}`);
for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => { cloud.stop(); wss.close(); process.exit(0); });
