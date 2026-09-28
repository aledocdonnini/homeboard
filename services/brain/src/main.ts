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
import { WebSocketServer, type WebSocket } from "ws";
import type { AnswerPanel, BrainToVoice, ToHome, VoiceToBrain } from "@homeboard/core/protocol";
import { DESTRUCTIVE, parse, type Intent } from "@homeboard/intents";
import { Cloud } from "./cloud.ts";
import { execute, openDeadlines } from "./executor.ts";
import { dueBetween, homeState, type Household, type Live } from "./state.ts";
import { Store } from "./store.ts";
import { Timers } from "./timers.ts";

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
/** Dopo "Confermi?" si aspetta un sì o un no per 20 secondi, poi si lascia perdere. */
const CONFIRM_MS = 20_000;

mkdirSync(dirname(DB_PATH), { recursive: true });
const store = new Store(DB_PATH);
const timers = new Timers(store);
const live: Live = { online: false, mic: "on", activity: "idle", answer: null, arrivedAt: null, pairing: null };
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

function onVoice(msg: VoiceToBrain) {
  switch (msg.type) {
    case "wake": live.activity = "listening"; break;
    case "heard": void hear(msg.text); return;
    case "nothing": live.activity = "idle"; break;
    case "speaking": live.activity = "speaking"; break;
    case "spoken": live.activity = "idle"; toScreens({ type: "level", value: null }); break;
    case "level": toScreens({ type: "level", value: msg.value }); return;
    case "mic": live.mic = msg.muted ? "muted" : "on"; break;
  }
  redraw();
}

// ——— Una frase ———
async function hear(said: string) {
  const house = store.get<Household>("household");
  if (!house) return say("Prima devo essere abbinato a una casa: il codice è sullo schermo.");
  live.activity = "thinking";
  redraw();
  const now = new Date();
  const intent = parse(said, {
    now, timezone: house.timezone,
    timers: timers.list.flatMap((t) => (t.label ? [t.label] : [])),
    deadlines: openDeadlines(store).map((d) => String(d.title)),
  });
  console.log(`→ ${JSON.stringify(intent)}`);

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
  const result = execute(todo, { store, timers, householdId: house.id, timezone: house.timezone, now });
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
    void cloud.publishTimers(timers.list);
    redraw();
  }
  if (now.getTime() - lastCheck.getTime() >= 10_000) {
    const house = store.get<Household>("household");
    if (house) for (const title of dueBetween(store.live("reminders"), lastCheck, now, house.timezone)) answer("promemoria", `È ora: ${title.charAt(0).toLowerCase()}${title.slice(1)}.`, { kind: "text" });
    lastCheck = now;
    redraw(); // i promemoria imminenti e le risposte scadute cambiano col tempo
  }
}, 250);

// ——— Supabase ———
const cloud = new Cloud(store, env("SUPABASE_URL"), env("SUPABASE_PUBLISHABLE_KEY"), {
  changed: redraw,
  arrived(name) {
    live.arrivedAt = new Date().toISOString();
    say(`In lista: ${name.charAt(0).toLowerCase()}${name.slice(1)}.`);
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
