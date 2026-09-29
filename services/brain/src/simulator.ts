// Simulatore di brain: la postazione /casa senza Raspberry, microfono né Supabase.
// Stesso protocollo di brain (packages/core/src/protocol.ts) su ws://127.0.0.1:8765, stato in memoria.
// Le frasi scritte qui passano dall'interprete vero (@homeboard/intents), come se le avesse trascritte voice.
//
//   npm run simulate -w @homeboard/brain          poi apri http://localhost:3000/casa
//   npm run simulate -w @homeboard/brain -- --demo   un giro di tutti i pannelli, da solo
//
// Comandi: vedi HELP qui sotto. Una riga senza "/" è una frase detta a Roby.

import { createInterface } from "node:readline";
import { WebSocketServer, type WebSocket } from "ws";
import type { Answer, AnswerPanel, HomeState, ToHome } from "@homeboard/core/protocol";
import { addDays, zonedDate, zonedInstant } from "@homeboard/core/recurrence";
import { secondsLeft, spoken } from "@homeboard/core/timers";
import { DESTRUCTIVE, parse, sameThing, smalltalkReply, type Intent } from "@homeboard/intents";

const PORT = Number(process.env.BRAIN_PORT ?? 8765);
const TZ = "Europe/Rome";
const HELP = `Comandi:
  <frase>              detta a Roby (es. "timer pasta 1 minuto", "cosa manca?", "ricordami tra 20 minuti di uscire")
  /ascolta /pensa      Roby in ascolto, sta pensando
  /parla <testo>       Roby parla (la bocca segue un volume finto)
  /muto                microfono spento/acceso
  /offline             senza internet sì/no
  /notte               notte sì/no
  /abbina              da abbinare sì/no (mostra il codice)
  /arriva <cosa>       qualcuno aggiunge alla spesa dal telefono (Roby sorpreso)
  /scadenza <giorni> <titolo>    /promemoria <minuti> <titolo>
  /demo                giro di tutti i pannelli
  /stato               stampa lo stato`;

const household = { name: "Casa di prova", timezone: TZ, nightStart: "23:30", nightEnd: "07:00" };
const state: HomeState = {
  household, pairing: null, online: true, mic: "on", activity: "idle",
  timers: [], answer: null, shopping: ["Latte", "Uova", "Pane"],
  reminders: [], deadlines: [{ title: "Bollo auto", due: addDays(zonedDate(new Date(), TZ), 12) }], arrivedAt: null,
};
const notes: string[] = ["La chiave di scorta è da mia madre"];
let pending: Intent | null = null;

// ——— WebSocket verso /casa ———
const clients = new Set<WebSocket>();
const wss = new WebSocketServer({ host: "127.0.0.1", port: PORT });
const send = (msg: ToHome) => { const s = JSON.stringify(msg); for (const c of clients) c.send(s); };
const push = () => send({ type: "state", state });
wss.on("connection", (ws) => {
  clients.add(ws);
  ws.send(JSON.stringify({ type: "state", state } satisfies ToHome));
  ws.on("close", () => clients.delete(ws));
});

// ——— Tempo: i timer finiscono e suonano ———
setInterval(() => {
  const now = new Date();
  let changed = false;
  for (const t of state.timers) if (t.status === "running" && secondsLeft(t.endsAt, now) === 0) { t.status = "ringing"; changed = true; log(`⏰ suona: ${t.label ?? "timer"}`); }
  if (changed) push();
}, 250);

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (s: string) => console.log(`  ${s}`);
const id = () => Math.random().toString(36).slice(2, 10);
const and = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} e ${xs.at(-1)}`);

/** Roby dice una frase: activity "speaking" e un volume finto a 30 Hz, come farebbe voice con Piper. */
async function speak(text: string) {
  log(`🗣  ${text}`);
  state.activity = "speaking";
  push();
  const ms = Math.min(6000, 600 + text.length * 55);
  for (let t = 0; t < ms; t += 33) {
    send({ type: "level", value: Math.max(0, Math.sin(t / 90) * 0.5 + Math.sin(t / 37) * 0.3 + 0.2) });
    await wait(33);
  }
  send({ type: "level", value: null });
  state.activity = "idle";
  push();
}

function answer(said: string, reply: string, panel: AnswerPanel = { kind: "text" }) {
  state.answer = { id: id(), said, reply, panel, at: new Date().toISOString() } satisfies Answer;
}

/** Una frase detta a Roby: ascolta, pensa, esegue, risponde. */
async function hear(said: string) {
  if (state.mic === "muted") return log("microfono spento: /muto per riaccenderlo");
  state.activity = "listening"; push(); await wait(900);
  state.activity = "thinking"; push(); await wait(400);
  const now = new Date();
  const intent = parse(said, { now, timezone: TZ, timers: state.timers.flatMap((t) => (t.label ? [t.label] : [])), deadlines: state.deadlines.map((d) => d.title) });
  log(`→ ${JSON.stringify(intent)}`);

  if (pending && (intent.type === "confirm" || intent.type === "cancel")) {
    const todo = pending;
    pending = null;
    if (intent.type === "cancel") { answer(said, "Va bene, lascio stare."); return speak("Va bene, lascio stare."); }
    return run(todo, said, now);
  }
  if (DESTRUCTIVE.has(intent.type)) {
    pending = intent;
    answer(said, "Tolgo tutto dalla lista della spesa?");
    return speak("Tolgo tutto dalla lista della spesa? Dimmi sì o no.");
  }
  return run(intent, said, now);
}

async function run(intent: Intent, said: string, now: Date) {
  const today = zonedDate(now, TZ);
  let reply: string;
  switch (intent.type) {
    case "shopping.add":
      for (const item of intent.items) if (!state.shopping.some((s) => sameThing(item, s))) state.shopping.push(item);
      reply = `Aggiunto: ${and(intent.items.map((s) => s.toLowerCase()))}.`;
      answer(said, reply, { kind: "shopping", items: state.shopping });
      break;
    case "shopping.remove":
      state.shopping = state.shopping.filter((s) => !intent.items.some((i) => sameThing(i, s)));
      reply = "Tolto dalla lista.";
      answer(said, reply, { kind: "shopping", items: state.shopping });
      break;
    case "shopping.list":
      reply = state.shopping.length ? `Da prendere: ${and(state.shopping.map((s) => s.toLowerCase()))}.` : "La lista è vuota.";
      answer(said, reply, { kind: "shopping", items: state.shopping });
      break;
    case "shopping.clear":
      state.shopping = [];
      reply = "Fatto: la lista è vuota.";
      answer(said, reply, { kind: "shopping", items: [] });
      break;
    case "timer.start":
      state.timers.push({ id: id(), label: intent.label ?? null, durationS: intent.seconds, endsAt: new Date(now.getTime() + intent.seconds * 1000).toISOString(), status: "running" });
      reply = `Timer${intent.label ? ` ${intent.label}` : ""}: ${spoken(intent.seconds)}.`;
      state.answer = null; // si vede subito il conto alla rovescia
      break;
    case "timer.query": {
      const found = state.timers.filter((t) => !intent.label || (t.label && sameThing(intent.label, t.label)));
      reply = found.length ? found.map((t) => `${t.label ?? "timer"}: ${t.status === "ringing" ? "sta suonando" : `mancano ${spoken(secondsLeft(t.endsAt, now))}`}`).join(". ") : "Nessun timer attivo.";
      state.answer = null;
      break;
    }
    case "timer.stop": {
      const ringing = state.timers.filter((t) => t.status === "ringing");
      const drop = intent.label ? state.timers.filter((t) => t.label && sameThing(intent.label!, t.label)) : ringing.length ? ringing : state.timers;
      state.timers = state.timers.filter((t) => !drop.includes(t));
      reply = drop.length ? "Fermato." : "Non c'erano timer.";
      state.answer = null;
      break;
    }
    case "reminder.create":
      state.reminders.push({ title: intent.title, at: zonedInstant(intent.date, intent.time, TZ).toISOString() });
      reply = `Te lo ricordo ${intent.date === today ? "oggi" : intent.date === addDays(today, 1) ? "domani" : `il ${intent.date}`} alle ${intent.time}.`;
      answer(said, reply, { kind: "reminder", title: intent.title, date: intent.date, time: intent.time });
      break;
    case "deadline.query": {
      const d = state.deadlines.find((x) => !intent.title || sameThing(intent.title, x.title));
      reply = d ? `${d.title} scade il ${d.due}.` : "Non trovo quella scadenza.";
      answer(said, reply, d ? { kind: "deadline", title: d.title, due: d.due } : { kind: "text" });
      break;
    }
    case "deadline.complete":
      state.deadlines = state.deadlines.filter((d) => !sameThing(intent.title, d.title));
      reply = `Segnata fatta: ${intent.title}.`;
      answer(said, reply);
      break;
    case "note.save":
      notes.push(intent.body);
      reply = "Me lo ricordo.";
      answer(said, reply, { kind: "note", body: intent.body });
      break;
    case "note.ask": {
      const words = intent.question.toLowerCase().split(/[^\p{L}]+/u).filter((w) => w.length > 3);
      const hit = notes.find((n) => words.some((w) => sameThing(w, n)));
      reply = hit ? `Ho annotato: ${hit}` : "Non ho niente annotato su questo.";
      answer(said, reply, hit ? { kind: "note", body: hit } : { kind: "text" });
      break;
    }
    case "show": {
      if (intent.view === "settings") { reply = "Le impostazioni si aprono dal telefono."; state.answer = null; break; }
      const panels: Record<Exclude<typeof intent.view, "settings">, AnswerPanel> = {
        today: { kind: "today" }, timers: { kind: "timers" }, deadlines: { kind: "deadlines" },
        shopping: { kind: "shopping", items: state.shopping },
        reminders: { kind: "reminders", items: state.reminders },
        notes: { kind: "notes", items: notes.map((body) => ({ body, when: "Oggi" })) },
      };
      reply = { today: "Ecco la giornata.", timers: "Ecco i timer.", deadlines: "Ecco le scadenze.", shopping: "Ecco la spesa.", reminders: "Ecco i promemoria.", notes: "Ecco le note." }[intent.view];
      answer(said, reply, panels[intent.view]);
      break;
    }
    case "music": {
      // Finta riproduzione: per vedere il pannello "In onda" su /casa senza Spotify.
      if (intent.action === "play") state.music = { title: intent.query ?? "Bocca di rosa", artist: "Fabrizio De André", album: "Volume 1", context: intent.kind === "playlist" ? intent.query ?? null : null, cover: null, playing: true };
      else if (intent.action === "pause" && state.music) state.music = { ...state.music, playing: false };
      else if (intent.action === "resume" && state.music) state.music = { ...state.music, playing: true };
      reply = state.music ? (intent.action === "pause" ? "In pausa." : `Sta suonando ${state.music.title}.`) : "Non sta suonando niente.";
      answer(said, reply, { kind: "music" });
      break;
    }
    case "smalltalk":
      reply = smalltalkReply(intent.topic, now, TZ);
      state.answer = null;
      break;
    case "confirm": case "cancel":
      reply = "Non c'era niente da confermare.";
      answer(said, reply);
      break;
    case "unknown":
      reply = "Non ho capito.";
      answer(said, reply);
      break;
  }
  return speak(reply);
}

// ——— Comandi del simulatore ———
async function command(line: string) {
  const [cmd, ...rest] = line.trim().split(" ");
  const arg = rest.join(" ");
  switch (cmd) {
    case "/ascolta": state.activity = state.activity === "listening" ? "idle" : "listening"; break;
    case "/pensa": state.activity = state.activity === "thinking" ? "idle" : "thinking"; break;
    case "/parla": await speak(arg || "Ciao, sono Roby."); return;
    case "/muto": state.mic = state.mic === "on" ? "muted" : "on"; break;
    case "/offline": state.online = !state.online; break;
    case "/notte": {
      const night = state.household?.nightStart === "00:00";
      state.household = night ? household : { ...household, nightStart: "00:00", nightEnd: "23:59" };
      break;
    }
    case "/abbina":
      state.household = state.household ? null : household;
      state.pairing = state.household ? null : { code: "K7PX3M", expiresAt: new Date(Date.now() + 600_000).toISOString() };
      break;
    case "/arriva":
      state.shopping.push(arg || "Caffè");
      state.arrivedAt = new Date().toISOString();
      break;
    case "/scadenza": {
      const [n, ...title] = rest;
      state.deadlines.push({ title: title.join(" ") || "Assicurazione", due: addDays(zonedDate(new Date(), TZ), Number(n) || 2) });
      break;
    }
    case "/promemoria": {
      const [n, ...title] = rest;
      state.reminders.push({ title: title.join(" ") || "Chiamare la nonna", at: new Date(Date.now() + (Number(n) || 20) * 60_000).toISOString() });
      break;
    }
    case "/stato": console.log(JSON.stringify(state, null, 2)); return;
    case "/demo": return demo();
    default: console.log(HELP); return;
  }
  push();
}

async function demo() {
  const steps: [string, number][] = [
    ["cosa manca da comprare?", 4000], ["timer pasta 10 secondi", 3000], ["timer forno venti minuti", 9000],
    ["basta", 3000], ["ricordami tra venti minuti di chiamare la nonna", 5000],
    ["ricorda che il codice del cancello è 4512", 5000], ["qual è il codice del cancello?", 5000],
    ["/arriva Caffè", 4000], ["ferma il timer del forno", 3000], ["/promemoria 25 Portare fuori la plastica", 32_000],
    ["/muto", 3000], ["/muto", 1000], ["/notte", 5000], ["/notte", 1000],
  ];
  for (const [line, ms] of steps) {
    console.log(`> ${line}`);
    await (line.startsWith("/") ? command(line) : hear(line));
    await wait(ms);
  }
}

console.log(`Simulatore di brain su ws://127.0.0.1:${PORT}. Apri /casa. /help per i comandi.`);
if (process.argv.includes("--demo")) void demo();
const rl = createInterface({ input: process.stdin });
let queue = Promise.resolve();
rl.on("line", (line) => { queue = queue.then(() => (line.startsWith("/") ? command(line) : line.trim() ? hear(line) : undefined)); });
