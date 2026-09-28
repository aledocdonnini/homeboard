// Quando: durate ("dieci minuti"), ore ("alle nove e mezza di sera"), date ("domani", "il 5 ottobre"),
// ricorrenze ("ogni primo del mese"). Ogni funzione trova il pezzo nella frase e lo toglie.

import { addDays, addMonths, weekday, zonedDate, type PlainDate, type Recurrence } from "@homeboard/core/recurrence";
import { NUM, toNumber, type Utterance } from "./lexicon.ts";

const pad = (n: number) => String(n).padStart(2, "0");

/** Che ore sono, "HH:MM", nel fuso della casa. */
export const zonedTime = (instant: Date, tz: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(instant);

// ——— Durate ————————————————————————————————————————————————————————————————————

const UNIT_S: Record<string, number> = { ore: 3600, ora: 3600, minuti: 60, minuto: 60, min: 60, secondi: 1, secondo: 1, sec: 1 };
const TUNIT = String.raw`(ore|ora|minuti|minuto|min|secondi|secondo|sec)`;
const DURATION = new RegExp(String.raw`\b${NUM}[\s'](?:di )?${TUNIT}\b(?: e (mezz[ao]|un quarto|${NUM})(?: ${TUNIT}\b)?)?`, "g");

/** "dieci minuti", "un'ora e mezza", "2 ore e 10", "mezz'ora", "un quarto d'ora" → secondi. */
export function takeDuration(u: Utterance, prefix = ""): number | null {
  const fixed = u.take(new RegExp(String.raw`${prefix}\b(?:(?:una |un )?mezz'?ora|(un|tre) quart[oi] d'ora)\b`));
  if (fixed) return fixed[1] === "tre" ? 2700 : fixed[1] ? 900 : 1800;
  const re = new RegExp(prefix + DURATION.source, "g");
  for (const m of u.l.matchAll(re)) {
    const n = toNumber(m[1]!);
    if (n === null || n <= 0) continue;
    const unit = UNIT_S[m[2]!]!;
    let seconds = n * unit, length = m[0].length;
    if (m[3]) {
      const extra = /^mezz/.test(m[3]) ? unit / 2 : m[3] === "un quarto" ? unit / 4
        : toNumber(m[4]!) !== null ? toNumber(m[4]!)! * (m[5] ? UNIT_S[m[5]]! : unit === 3600 ? 60 : 1) : null;
      if (extra === null) length = m[0].indexOf(" e ");
      else seconds += extra;
    }
    u.cut(m.index, length);
    return Math.round(seconds);
  }
  return null;
}

// ——— Ore ——————————————————————————————————————————————————————————————————————

export type Period = "mattina" | "pomeriggio" | "sera" | "notte";
export type Clock = { h: number; m: number; period?: Period };

const PERIOD = String.raw`(?: (?:di|del|della|nel|in) (mattina|mattino|pomeriggio|sera|notte))?`;
const TIME = new RegExp(String.raw`\b(?:alle|all'|per le|verso le|entro le)\s?(?:ore )?${NUM}(?:[:.](\d{2})| e (mezz[ao]|un quarto|tre quarti|${NUM}))?${PERIOD}`, "g");

const period = (p?: string): Period | undefined => (p === "mattino" ? "mattina" : (p as Period | undefined));

export function takeTime(u: Utterance): Clock | null {
  const noon = u.take(/\b(?:a |alle )?(mezzogiorno|mezzanotte)\b/);
  if (noon) return { h: noon[1] === "mezzogiorno" ? 12 : 0, m: 0, period: noon[1] === "mezzogiorno" ? "pomeriggio" : "notte" };
  for (const m of u.l.matchAll(TIME)) {
    const h = toNumber(m[1]!);
    if (h === null || h > 24 || !Number.isInteger(h)) continue;
    let min = 0, length = m[0].length;
    if (m[2]) min = Number(m[2]);
    else if (m[3]) {
      const extra = /^mezz/.test(m[3]) ? 30 : m[3] === "un quarto" ? 15 : m[3] === "tre quarti" ? 45 : toNumber(m[4]!);
      if (extra === null || extra > 59) length = m[0].indexOf(" e ");
      else min = extra;
    }
    if (min > 59) continue;
    const p = length === m[0].length ? period(m[5]) : undefined;
    u.cut(m.index, length);
    return { h: h % 24, m: min, ...(p ? { period: p } : {}) };
  }
  return null;
}

// ——— Date —————————————————————————————————————————————————————————————————————

export const WEEKDAY = String.raw`(luned[ii]|marted[ii]|mercoled[ii]|gioved[ii]|venerd[ii]|sabat[oi]|domenic(?:a|he))`;
const weekdayIndex = (w: string) => ["lun", "mar", "mer", "gio", "ven", "sab", "dom"].indexOf(w.slice(0, 3));
const MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
const MONTH = String.raw`(${MONTHS.join("|")})`;

export type Day = { date: PlainDate; period?: Period };

/** La prossima data (da oggi compreso) con quel giorno del mese; se il mese è più corto, l'ultimo giorno. */
export function nextDayOfMonth(today: PlainDate, day: number): PlainDate {
  for (let k = 0; ; k++) {
    const first = addMonths(`${today.slice(0, 8)}01`, k);
    const last = Number(addDays(addMonths(first, 1), -1).slice(8));
    const d = `${first.slice(0, 8)}${pad(Math.min(day, last))}`;
    if (d >= today) return d;
  }
}

/** Prossimo giorno della settimana (0 = lunedì), da domani in poi. */
const nextWeekday = (today: PlainDate, wd: number) => addDays(today, ((wd - weekday(today) + 6) % 7) + 1);

export function takeDate(u: Utterance, today: PlainDate): Day | null {
  let m: RegExpExecArray | null;
  if (u.take(/\bdopodomani\b/)) return { date: addDays(today, 2) };
  if (u.take(/\bdomattina\b/)) return { date: addDays(today, 1), period: "mattina" };
  if ((m = u.take(/\bdomani(?: (mattina|mattino|pomeriggio|sera|notte))?\b/))) return { date: addDays(today, 1), ...(m[1] ? { period: period(m[1])! } : {}) };
  if ((m = u.take(/\b(stamattina|stamani|stasera|stanotte|oggi pomeriggio|oggi)\b/))) {
    const p: Record<string, Period> = { stamattina: "mattina", stamani: "mattina", stasera: "sera", stanotte: "notte", "oggi pomeriggio": "pomeriggio" };
    return { date: today, ...(p[m[1]!] ? { period: p[m[1]!]! } : {}) };
  }
  const later = u.takeWhere(new RegExp(String.raw`\b(?:tra|fra) ${NUM} (giorn[oi]|settiman[ae]|mes[ei])\b`), (m) => {
    const n = toNumber(m[1]!);
    return n === null ? null : { date: m[2]!.startsWith("mes") ? addMonths(today, n) : addDays(today, n * (m[2]!.startsWith("sett") ? 7 : 1)) };
  });
  if (later) return later;
  if (u.take(/\b(?:la )?(?:prossima settimana|settimana prossima)\b/)) return { date: addDays(today, 7) };
  if ((m = u.take(/\b(?:il |l')?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/))) return dated(today, +m[1]!, +m[2]!, m[3]);
  const withMonth = u.takeWhere(new RegExp(String.raw`\b(?:${WEEKDAY} )?(?:(?:il|l') ?)?${NUM} (?:di )?${MONTH}(?: (\d{4}))?\b`), (m) => {
    const d = toNumber(m[2]!);
    return d === null ? null : dated(today, d, MONTHS.indexOf(m[3]!) + 1, m[4]);
  });
  if (withMonth) return withMonth;
  if ((m = u.take(new RegExp(String.raw`\b(?:(?:il|la) )?(?:prossim[oa] )?${WEEKDAY}(?: prossim[oa])?\b`)))) {
    return { date: nextWeekday(today, weekdayIndex(m[1]!)) };
  }
  return u.takeWhere(new RegExp(String.raw`\b(?:il|l') ?${NUM}\b(?! (?:minut|or[ae]|second))`), (m) => {
    const d = toNumber(m[1]!);
    return d !== null && Number.isInteger(d) && d >= 1 && d <= 31 ? { date: nextDayOfMonth(today, d) } : null;
  });
}

function dated(today: PlainDate, day: number, month: number, year?: string): Day | null {
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  const y = year ? (year.length === 2 ? 2000 + Number(year) : Number(year)) : Number(today.slice(0, 4));
  const d = `${y}-${pad(month)}-${pad(day)}`;
  if (Number(addMonths(d, 0).slice(8)) !== day) return null; // 31 aprile
  return { date: !year && d < today ? `${y + 1}${d.slice(4)}` : d };
}

// ——— Ricorrenze ———————————————————————————————————————————————————————————————

export type Repeat = { recurrence: Recurrence; start?: PlainDate; period?: Period };

export function takeRecurrence(u: Utterance, today: PlainDate): Repeat | null {
  let m: RegExpExecArray | null;
  if ((m = u.take(/\b(?:ogni|tutt[ie] (?:i|le)) (giorn[oi]|mattin[ae]|ser[ae])\b/))) {
    const p = m[1]!.startsWith("mattin") ? "mattina" : m[1]!.startsWith("ser") ? "sera" : undefined;
    return { recurrence: { freq: "day", interval: 1 }, ...(p ? { period: p } : {}) };
  }
  const dom = u.takeWhere(new RegExp(String.raw`\b(?:ogni|il) ${NUM} (?:di ogni|del|di) mese\b`), (m) => {
    const d = toNumber(m[1]!);
    return d !== null && Number.isInteger(d) && d >= 1 && d <= 31 ? d : null;
  });
  if (dom) return { recurrence: { freq: "month", interval: 1 }, start: nextDayOfMonth(today, dom) };
  if ((m = u.take(new RegExp(String.raw`\b(?:ogni|tutt[ie] (?:i|le)) ((?:${WEEKDAY.slice(1, -1)})(?:(?:,| e) (?:${WEEKDAY.slice(1, -1)}))*)\b`)))) {
    const days = [...m[1]!.matchAll(new RegExp(WEEKDAY, "g"))].map((w) => weekdayIndex(w[1]!));
    return { recurrence: { freq: "week", interval: 1, byWeekday: [...new Set(days)].sort() } };
  }
  const every = u.takeWhere(new RegExp(String.raw`\bogni ${NUM} (giorni|settimane|mesi|anni)\b`), (m): Repeat | null => {
    const n = toNumber(m[1]!);
    const freq = ({ giorni: "day", settimane: "week", mesi: "month", anni: "year" } as const)[m[2] as "giorni"];
    return n !== null && Number.isInteger(n) && n >= 1 && n <= 99 ? { recurrence: { freq, interval: n } } : null;
  });
  if (every) return every;
  if ((m = u.take(/\b(?:ogni (settimana|mese|anno)|tutti gli anni|tutti i mesi|tutte le settimane)\b/))) {
    const w = m[1] ?? m[0];
    const freq = w.includes("sett") ? "week" : w.includes("mes") ? "month" : "year";
    return { recurrence: { freq, interval: 1 } };
  }
  return null;
}

// ——— Mettere insieme ——————————————————————————————————————————————————————————

const DEFAULT_TIME: Record<Period, number> = { mattina: 9, pomeriggio: 15, sera: 20, notte: 22 };

/**
 * Data e ora di un promemoria. Senza "di sera" o simili:
 * - con una data esplicita, le ore da 1 a 6 sono del pomeriggio ("domani alle tre" = 15:00);
 * - senza data, la prossima volta che l'orologio segna quell'ora ("alle otto", detto alle 10 → 20:00).
 * Senza ora: 9:00, o l'ora tipica del momento del giorno ("stasera" → 20:00).
 */
export function resolveWhen(now: Date, tz: string, day: Day | null, clock: Clock | null, repeat: Repeat | null): { date: PlainDate; time: string } {
  const today = zonedDate(now, tz), nowTime = zonedTime(now, tz);
  const p = clock?.period ?? day?.period ?? repeat?.period;
  const explicitDay = day?.date ?? repeat?.start;
  if (!clock) {
    return { date: explicitDay ?? today, time: `${pad(p ? DEFAULT_TIME[p] : 9)}:00` };
  }
  let h = clock.h;
  if (p === "pomeriggio" || p === "sera") { if (h < 12) h += 12; }
  else if (p === "notte") { if (h >= 8 && h < 12) h += 12; }
  else if (p === "mattina") { if (h === 12) h = 0; }
  else if (explicitDay || repeat) { if (h >= 1 && h <= 6) h += 12; }
  else {
    const at = (hh: number) => `${pad(hh)}:${pad(clock.m)}`;
    const candidates = h >= 1 && h < 12 ? [h, h + 12] : [h];
    const next = candidates.find((c) => at(c) > nowTime);
    if (next !== undefined) return { date: today, time: at(next) };
    return { date: addDays(today, 1), time: at(h >= 1 && h <= 6 ? h + 12 : h) };
  }
  const time = `${pad(h)}:${pad(clock.m)}`;
  return { date: explicitDay ?? (time > nowTime || repeat ? today : addDays(today, 1)), time };
}
