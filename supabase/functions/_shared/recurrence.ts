// Ricorrenze di promemoria e scadenze: logica pura, senza dipendenze.
// La usano la PWA (apps/web, alias @shared) e la Edge Function delle notifiche (Deno). Test in recurrence.test.ts.
//
// Scelte:
// - Le date sono date di calendario "YYYY-MM-DD", senza ora né fuso: il 3 marzo è il 3 marzo ovunque.
// - Mesi e anni si contano sempre dalla data iniziale: il 31 gennaio "ogni mese" dà 28 febbraio, 31 marzo,
//   30 aprile… (non scivola al 28). Il 29 febbraio "ogni anno" dà il 28 negli anni non bisestili.
// - Gli orari dei promemoria sono ore "da orologio" nel fuso della casa: le 8:00 restano le 8:00 anche
//   dopo il cambio dell'ora legale.

export type Freq = "day" | "week" | "month" | "year";
/** interval: ogni quanti giorni/settimane/mesi/anni. byWeekday (solo "week"): 0 = lunedì … 6 = domenica. */
export type Recurrence = { freq: Freq; interval: number; byWeekday?: number[] };
export type PlainDate = string;

const DAY = 86_400_000;
const pad = (n: number) => String(n).padStart(2, "0");
const parts = (d: PlainDate) => d.split("-").map(Number) as [number, number, number];
const toUTC = (d: PlainDate) => {
  const [y, m, dd] = parts(d);
  return Date.UTC(y, m - 1, dd);
};
const fromUTC = (ms: number): PlainDate => new Date(ms).toISOString().slice(0, 10);
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

export const addDays = (d: PlainDate, n: number) => fromUTC(toUTC(d) + n * DAY);
export const daysBetween = (from: PlainDate, to: PlainDate) => Math.round((toUTC(to) - toUTC(from)) / DAY);
/** 0 = lunedì … 6 = domenica. */
export const weekday = (d: PlainDate) => (new Date(toUTC(d)).getUTCDay() + 6) % 7;

/** Aggiunge mesi tenendo il giorno, o l'ultimo del mese se non esiste (31 gen + 1 = 28/29 feb). */
export function addMonths(d: PlainDate, n: number): PlainDate {
  const [y, m, dd] = parts(d);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12), nm = (total % 12) + 1;
  return `${ny}-${pad(nm)}-${pad(Math.min(dd, daysInMonth(ny, nm)))}`;
}

/** La k-esima occorrenza (0 = la data iniziale), sempre calcolata dall'inizio: niente deriva a fine mese. */
function nth(start: PlainDate, r: Recurrence, k: number): PlainDate {
  const n = k * r.interval;
  if (r.freq === "day") return addDays(start, n);
  if (r.freq === "week") return addDays(start, 7 * n);
  return addMonths(start, r.freq === "month" ? n : 12 * n);
}

/**
 * Prima occorrenza da `from` in poi (dopo `from`, se `after`). null se non ce ne sono più (evento singolo passato).
 * Confronto fra date "YYYY-MM-DD": l'ordine delle stringhe è quello delle date.
 */
export function nextOccurrence(start: PlainDate, r: Recurrence | null, from: PlainDate, after = false): PlainDate | null {
  const ok = (d: PlainDate) => (after ? d > from : d >= from);
  if (!r) return ok(start) ? start : null;
  if (r.freq === "week" && r.byWeekday?.length) {
    // Settimane "attive" ogni `interval` a partire da quella della data iniziale; dentro, i giorni scelti.
    const days = [...new Set(r.byWeekday)].sort();
    const monday = addDays(start, -weekday(start));
    const lower = from > start ? from : start;
    for (let k = Math.max(0, Math.floor(daysBetween(monday, lower) / (7 * r.interval)) - 1); ; k++) {
      for (const wd of days) {
        const d = addDays(monday, 7 * r.interval * k + wd);
        if (d >= start && ok(d)) return d;
      }
    }
  }
  // Stima dell'indice vicino a `from`, poi avanti di uno finché non ci siamo.
  const [sy, sm] = parts(start), [fy, fm] = parts(from);
  const approx = r.freq === "day" ? daysBetween(start, from) / r.interval
    : r.freq === "week" ? daysBetween(start, from) / (7 * r.interval)
    : ((fy - sy) * 12 + (fm - sm)) / (r.interval * (r.freq === "year" ? 12 : 1));
  for (let k = Math.max(0, Math.floor(approx) - 1); ; k++) {
    const d = nth(start, r, k);
    if (ok(d)) return d;
  }
}

/** Le occorrenze in un intervallo di date (estremi inclusi), per calendari e liste "oggi / domani". */
export function occurrencesBetween(start: PlainDate, r: Recurrence | null, from: PlainDate, to: PlainDate): PlainDate[] {
  const out: PlainDate[] = [];
  for (let d = nextOccurrence(start, r, from); d && d <= to; d = r ? nextOccurrence(start, r, d, true) : null) out.push(d);
  return out;
}

/** Giorni in cui avvisare per una scadenza: `days` prima (0 = il giorno stesso), dal più lontano. */
export const notifyDates = (due: PlainDate, days: number[]) =>
  [...new Set(days)].sort((a, b) => b - a).map((n) => addDays(due, -n));

// ——— Fusi orari ———————————————————————————————————————————————————————————————

/** Scarto fra l'ora locale del fuso e UTC, in ms, a un certo istante (con l'ora legale se c'è). */
function offsetMs(instant: number, tz: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(new Date(instant)).map((x) => [x.type, x.value]),
  );
  const wall = Date.UTC(+p.year!, +p.month! - 1, +p.day!, +p.hour!, +p.minute!, +p.second!);
  return wall - Math.floor(instant / 1000) * 1000;
}

/** L'istante in cui l'orologio della casa segna `date` alle `time` ("HH:MM"). */
export function zonedInstant(date: PlainDate, time: string, tz: string): Date {
  const [h, mi] = time.split(":").map(Number) as [number, number];
  const wall = toUTC(date) + (h * 60 + mi) * 60_000;
  const first = wall - offsetMs(wall, tz);
  return new Date(wall - offsetMs(first, tz)); // seconda passata: giusto anche a cavallo del cambio d'ora
}

/** Che giorno è, nel fuso della casa, a un certo istante. */
export const zonedDate = (instant: Date, tz: string): PlainDate =>
  new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);

/** Prossimo istante di un promemoria dopo `now` (null se era una volta sola ed è passato). */
export function nextReminderAt(start: PlainDate, time: string, r: Recurrence | null, now: Date, tz: string): Date | null {
  let d = nextOccurrence(start, r, zonedDate(now, tz));
  while (d) {
    const at = zonedInstant(d, time, tz);
    if (at > now) return at;
    d = r ? nextOccurrence(start, r, d, true) : null;
  }
  return null;
}

// ——— Parole ————————————————————————————————————————————————————————————————————

const WEEKDAYS = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"];
const UNITS: Record<Freq, [string, string]> = { day: ["giorno", "giorni"], week: ["settimana", "settimane"], month: ["mese", "mesi"], year: ["anno", "anni"] };

/** "Ogni giorno", "Ogni 2 settimane: lun, gio", "Ogni anno", "Una volta". */
export function describe(r: Recurrence | null): string {
  if (!r) return "Una volta";
  const [one, many] = UNITS[r.freq];
  const every = r.interval === 1 ? `Ogni ${one}` : `Ogni ${r.interval} ${many}`;
  const days = r.freq === "week" && r.byWeekday?.length ? `: ${[...new Set(r.byWeekday)].sort().map((d) => WEEKDAYS[d]).join(", ")}` : "";
  return every + days;
}
