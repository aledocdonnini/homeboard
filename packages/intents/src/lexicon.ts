// Parole e testo: numeri in lettere, articoli, e una frase da cui togliere i pezzi riconosciuti.

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "");

/**
 * La versione su cui cercano le regole: minuscola e senza accenti ("venerdì" → "venerdi"), perché in JavaScript
 * \b non vede le lettere accentate. Carattere per carattere, così resta lunga uguale all'originale.
 */
const searchable = (s: string) => [...s.toLowerCase()].map((c) => (c.length === 1 ? c.normalize("NFD")[0]! : c)).join("");

const UNITS = ["zero", "uno", "due", "tre", "quattro", "cinque", "sei", "sette", "otto", "nove", "dieci", "undici", "dodici",
  "tredici", "quattordici", "quindici", "sedici", "diciassette", "diciotto", "diciannove"];
const TENS: [string, number][] = [["venti", 20], ["trenta", 30], ["quaranta", 40], ["cinquanta", 50], ["sessanta", 60],
  ["settanta", 70], ["ottanta", 80], ["novanta", 90]];

/** "dieci" → 10, "ventitré" → 23, "centoventi" → 120, "7" → 7, "un"/"una"/"primo" → 1. Altrimenti null. */
export function toNumber(word: string): number | null {
  const w = fold(word.toLowerCase());
  if (/^\d+([.,]\d+)?$/.test(w)) return Number(w.replace(",", "."));
  if (w === "un" || w === "una" || w === "primo") return 1;
  const unit = UNITS.indexOf(w);
  if (unit >= 0) return unit;
  const hundreds = w.match(/^(.*?)cento(.*)$/);
  if (hundreds) {
    const h = hundreds[1] ? toNumber(hundreds[1]) : 1, r = hundreds[2] ? toNumber(hundreds[2]) : 0;
    return h !== null && r !== null && h >= 1 && h <= 9 && r < 100 ? h * 100 + r : null;
  }
  for (const [word, value] of TENS) {
    if (w === word) return value;
    const u = UNITS.indexOf(w.slice(word.length));
    if (w.startsWith(word) && u >= 2 && u <= 9) return value + u;
    // "ventuno", "trentotto": la vocale cade davanti a uno e otto.
    const stem = word.slice(0, -1), rest = w.slice(stem.length);
    if (w.startsWith(stem) && (rest === "uno" || rest === "otto")) return value + (rest === "uno" ? 1 : 8);
  }
  return null;
}

/** Una parola, numero o lettere (con accenti e apostrofo di "un'"). */
export const NUM = String.raw`(\d+(?:[.,]\d+)?|[a-z]+)`;

/** Articoli e preposizioni che non fanno parte di un nome: "il latte", "della luce" (in testa). */
const LEADING = /^(?:\s+|[:,;.-]|(?:il|lo|la|i|gli|le|un|uno|una|del|dello|della|dei|degli|delle|al|allo|alla|ai|agli|alle|dal|dallo|dalla|di|da|per|che|poi|anche|a|e)(?=\s|$)|(?:l|dell|all|un|nell|dall|sull)')+/;
const TRAILING = /(?:\s+|[:,;.-]|(?<=\s|^)(?:il|lo|la|i|gli|le|un|una|del|della|di|da|per|che|a|e|poi|anche)|(?<=\s|^)(?:l|dell|all|un)')+$/;
/** Solo i legamenti in testa ("di chiamare…", "della riunione"): gli articoli dei titoli restano. */
const CONNECTORS = /^(?:\s+|[:,;.-]|(?:di|del|della|dello|dei|degli|delle|che|a|da|per)(?=\s|$)|dell')+/;

/**
 * La frase detta o scritta. Si cercano i pezzi sulla versione minuscola e si tolgono da entrambe
 * sostituendoli con spazi: gli indici restano allineati, e il resto conserva maiuscole e accenti.
 */
export class Utterance {
  o: string;
  l: string;
  constructor(text: string) {
    this.o = text.normalize("NFC").replace(/[’`´]/g, "'").replace(/\s+/g, " ").trim();
    this.l = searchable(this.o);
  }
  /** Toglie un pezzo. Gli spazi stanno negli stessi punti delle due versioni: si ripuliscono allo stesso modo. */
  cut(index: number, length: number) {
    const tidy = (s: string) => s.replace(/ {2,}/g, " ").trim();
    this.o = tidy(this.o.slice(0, index) + " " + this.o.slice(index + length));
    this.l = tidy(this.l.slice(0, index) + " " + this.l.slice(index + length));
  }
  /** Il primo pezzo che `read` accetta (null = non vale, si guarda il successivo): lo toglie e ne restituisce il valore. */
  takeWhere<T>(re: RegExp, read: (m: RegExpExecArray) => T | null): T | null {
    for (const m of this.l.matchAll(new RegExp(re.source, "g"))) {
      const value = read(m);
      if (value !== null) {
        this.cut(m.index, m[0].length);
        return value;
      }
    }
    return null;
  }
  find(re: RegExp) {
    return re.exec(this.l);
  }
  /** Cerca e, se trova, toglie. */
  take(re: RegExp) {
    const m = re.exec(this.l);
    if (m) this.cut(m.index, m[0].length);
    return m;
  }
  /** Quello che resta, in forma originale. `mode`: "name" toglie articoli ai due capi, "title" solo i legamenti in testa. */
  rest(mode: "name" | "title" = "name") {
    let o = this.o, l = this.l;
    const lead = (mode === "name" ? LEADING : CONNECTORS).exec(l)?.[0].length ?? 0;
    o = o.slice(lead); l = l.slice(lead);
    const trail = mode === "name" ? TRAILING.exec(l) : /[\s:,;.-]+$/.exec(l);
    if (trail) { o = o.slice(0, trail.index); l = l.slice(0, trail.index); }
    return o.replace(/\s+/g, " ").trim();
  }
  get text() {
    return this.l.replace(/\s+/g, " ").trim();
  }
}

export const capitalize = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/** "i biscotti" → "biscotti"; "due litri di latte" → "2 litri di latte"; "un po' di pane" → "pane". */
export function itemName(raw: string): string {
  const u = new Utterance(raw);
  // "un chilo di farina" → "1 chilo di farina": qui "un" è una quantità, non un articolo.
  const measure = u.take(/^(?:un|una|uno) (?=(?:chilo|kg|litro|etto|pacco|pacchetto|confezione|bottiglia|scatola|scatoletta|vasetto|barattolo|sacchetto|rotolo|mazzo|cespo|dozzina|vaschetta|tubetto|flacone|busta)\b)/);
  if (measure) return capitalize(`1 ${u.rest("name")}`);
  u.take(/^(?:(?:un )?po' d(?:i|el|ella|ello|egli|elle)|qualche|dell[ae]? |dei |degli |del )\s*/);
  let name = u.rest("name");
  const first = name.split(" ")[0] ?? "";
  const n = toNumber(first);
  if (n !== null && n > 1 && !/^\d/.test(first) && name.includes(" ")) name = `${n}${name.slice(first.length)}`;
  return capitalize(name);
}

/** Confronto fra nomi detti e nomi salvati: "bolletta luce" trova "Bolletta della luce". */
export function sameThing(said: string, known: string): boolean {
  const words = (s: string) => fold(s.toLowerCase()).split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !["del", "della", "dello", "dei", "delle", "degli"].includes(w));
  const a = words(said), b = words(known);
  return a.length > 0 && a.every((w) => b.some((k) => k.startsWith(w.slice(0, -1)) || w.startsWith(k.slice(0, -1))));
}
