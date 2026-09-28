// La postazione di casa (/casa): cosa va nella parte centrale e che faccia fa Roby. Puro, testato in station.test.ts.
// Un solo layout: Roby, ora e stato del microfono restano fissi; cambia solo il pannello centrale.

import { daysBetween, zonedDate, type PlainDate } from "./recurrence.ts";
import type { Answer, HomeState, HomeTimer } from "./protocol.ts";

/** La risposta a una richiesta resta sullo schermo per mezzo minuto, poi torna il resto. */
export const ANSWER_MS = 30_000;
/** Una vista chiesta apposta ("mostrami la spesa") resta un minuto: la si guarda, non la si ascolta. */
export const VIEW_MS = 60_000;
const VIEWS = new Set(["today", "timers", "deadlines", "reminders", "notes", "shopping"]);
/** Un promemoria entro un'ora, o una scadenza entro tre giorni (o superata), va in primo piano. */
export const SOON_MINUTES = 60;
export const WORRY_DAYS = 3;
/** Roby resta sorpreso per qualche secondo quando arriva qualcosa di nuovo. */
export const SURPRISE_MS = 5_000;

export type Soon = {
  reminder?: { title: string; at: string; minutes: number };
  deadline?: { title: string; due: PlainDate; daysLeft: number };
};

export type Panel =
  | { kind: "pairing" }
  | { kind: "ringing"; timer: HomeTimer }
  | { kind: "answer"; answer: Answer }
  | { kind: "night" }
  | { kind: "timers"; timers: HomeTimer[] }
  | { kind: "soon"; soon: Soon }
  | { kind: "idle" };

/** Orari "HH:MM". La notte può scavalcare la mezzanotte (23:30 → 07:00). */
export const isNight = (time: string, start: string, end: string) =>
  start <= end ? time >= start && time < end : time >= start || time < end;

const clock = (now: Date, tz: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);

function soon(s: HomeState, now: Date, tz: string): Soon | null {
  const reminder = s.reminders
    .map((r) => ({ ...r, minutes: Math.ceil((new Date(r.at).getTime() - now.getTime()) / 60_000) }))
    .filter((r) => r.minutes >= 0 && r.minutes <= SOON_MINUTES)
    .sort((a, b) => a.minutes - b.minutes)[0];
  const today = zonedDate(now, tz);
  const deadline = s.deadlines
    .map((d) => ({ ...d, daysLeft: daysBetween(today, d.due) }))
    .filter((d) => d.daysLeft <= WORRY_DAYS)
    .sort((a, b) => a.daysLeft - b.daysLeft)[0];
  if (!reminder && !deadline) return null;
  return { ...(reminder ? { reminder } : {}), ...(deadline ? { deadline } : {}) };
}

/**
 * Il pannello centrale, in ordine di priorità:
 * 1. un timer che suona; 2. la risposta appena data (ANSWER_MS, o VIEW_MS per una vista chiesta); di notte, se nessuno parla con Roby,
 * "fine delle trasmissioni"; 3. i timer attivi; 4. un promemoria imminente o una scadenza vicina; 5. il monoscopio.
 */
export function pickPanel(s: HomeState, now: Date, { sticky = false } = {}): Panel {
  if (!s.household) return { kind: "pairing" };
  const tz = s.household.timezone;
  const ringing = s.timers.find((t) => t.status === "ringing");
  if (ringing) return { kind: "ringing", timer: ringing };
  // sticky (il computer): la vista chiesta resta finché non se ne chiede un'altra.
  const ttl = sticky ? Infinity : VIEWS.has(s.answer?.panel.kind ?? "") ? VIEW_MS : ANSWER_MS;
  if (s.answer && now.getTime() - new Date(s.answer.at).getTime() < ttl) return { kind: "answer", answer: s.answer };
  if (s.activity === "idle" && isNight(clock(now, tz), s.household.nightStart, s.household.nightEnd)) return { kind: "night" };
  const running = s.timers.filter((t) => t.status === "running").sort((a, b) => a.endsAt.localeCompare(b.endsAt));
  if (running.length) return { kind: "timers", timers: running };
  const next = soon(s, now, tz);
  if (next) return { kind: "soon", soon: next };
  return { kind: "idle" };
}

export type Face = {
  expression: "neutral" | "happy" | "worried" | "nervous" | "surprised" | "sleepy" | "listening" | "thinking" | "excited";
  mode: "idle" | "listening" | "talking";
};

/** Che faccia fa Roby: prima quello che sta facendo (ascolta, pensa), poi quello che c'è sullo schermo. */
export function faceFor(s: HomeState, panel: Panel, now: Date): Face {
  if (s.activity === "listening") return { expression: "listening", mode: "listening" };
  if (s.activity === "thinking") return { expression: "thinking", mode: "idle" };
  const mode = s.activity === "speaking" ? "talking" : "idle";
  if (panel.kind === "night") return { expression: "sleepy", mode };
  if (panel.kind === "ringing") return { expression: "excited", mode };
  if (s.arrivedAt && now.getTime() - new Date(s.arrivedAt).getTime() < SURPRISE_MS) return { expression: "surprised", mode };
  if (s.household) {
    const today = zonedDate(now, s.household.timezone);
    const days = s.deadlines.map((d) => daysBetween(today, d.due));
    if (days.some((d) => d < 0)) return { expression: "nervous", mode };
    if (days.some((d) => d <= WORRY_DAYS)) return { expression: "worried", mode };
  }
  if (s.shopping.length === 0) return { expression: "happy", mode };
  return { expression: "neutral", mode };
}

/** Il pannello cambia davvero (e fa la neve) solo se cambia cosa mostra, non a ogni secondo. */
export const panelKey = (p: Panel) =>
  p.kind === "ringing" ? `ringing:${p.timer.id}` : p.kind === "answer" ? `answer:${p.answer.id}` : p.kind;
