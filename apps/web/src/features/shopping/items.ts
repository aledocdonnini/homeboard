// Logica pura della lista: reparti, aggiunta rapida, ordinamento. Niente rete, niente React.

// Reparti nell'ordine in cui si incontrano di solito al supermercato.
export const CATEGORIES = [
  { id: "frutta-verdura", label: "Frutta e verdura" },
  { id: "pane", label: "Pane e forno" },
  { id: "colazione", label: "Colazione" },
  { id: "dispensa", label: "Pasta e dispensa" },
  { id: "carne-pesce", label: "Carne e pesce" },
  { id: "latticini", label: "Latte, uova e formaggi" },
  { id: "surgelati", label: "Surgelati" },
  { id: "bevande", label: "Bevande" },
  { id: "casa", label: "Casa e igiene" },
  { id: "altro", label: "Altro" },
] as const;
export type Category = (typeof CATEGORIES)[number]["id"];
const ORDER = new Map<string, number>(CATEGORIES.map((c, i) => [c.id, i]));
export const categoryLabel = (id: string) => CATEGORIES.find((c) => c.id === id)?.label ?? "Altro";

export type Item = {
  id: string;
  household_id: string;
  name: string;
  category: string;
  checked: boolean;
  position: number;
  updated_at: string;
  deleted_at: string | null;
};

export type Stat = { name_norm: string; name: string; category: string; uses: number };

export const normalize = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

/** "latte, uova\npane" → ["latte", "uova", "pane"]. Solo virgole, punti e virgola e a capo: "sale e pepe" resta uno. */
export const parseQuickAdd = (text: string) =>
  text.split(/[,;\n]/).map((s) => s.trim().replace(/\s+/g, " ")).filter(Boolean).map((s) => s[0]!.toUpperCase() + s.slice(1));

// Parole chiave → reparto, per le cose mai aggiunte prima. La prima parola che corrisponde vince.
const KEYWORDS: [Category, string[]][] = [
  ["frutta-verdura", ["mel", "pere", "banan", "aranc", "limon", "fragol", "uva", "kiwi", "insalat", "pomodor", "zucchin", "patat", "cipoll", "aglio", "carot", "melanzan", "peperon", "spinac", "basilico", "prezzemolo", "frutta", "verdur", "rucola", "funghi", "avocado"]],
  ["pane", ["pane", "panin", "focacc", "grissin", "crackers", "piadin", "pizza"]],
  ["colazione", ["caffè", "caffe", "tè", "the ", "biscott", "cereali", "fette biscottate", "marmellat", "nutella", "miele", "cornetti"]],
  ["dispensa", ["pasta", "spaghetti", "penne", "riso", "farina", "zucchero", "sale", "olio", "aceto", "passata", "pelati", "tonno", "legumi", "ceci", "fagioli", "lenticchie", "sugo", "pesto", "spezie", "lievito"]],
  ["carne-pesce", ["pollo", "manzo", "maiale", "salsicc", "hamburger", "macinat", "prosciutto", "salame", "bresaola", "mortadella", "pesce", "salmone", "merluzzo", "gamberi", "tacchino", "wurstel"]],
  ["latticini", ["latte", "yogurt", "burro", "panna", "uova", "formaggio", "mozzarella", "parmigiano", "grana", "ricotta", "stracchino", "mascarpone", "pecorino"]],
  ["surgelati", ["surgelat", "gelato", "piselli", "bastoncini", "sofficini"]],
  ["bevande", ["acqua", "vino", "birra", "succo", "aranciata", "coca", "bibit", "spremuta"]],
  ["casa", ["detersivo", "sapone", "shampoo", "dentifricio", "carta igienica", "scottex", "carta cucina", "spugn", "sacchetti", "ammorbidente", "candeggina", "pannolini", "deodorante", "fazzoletti", "bagnoschiuma"]],
];

/** Reparto proposto: quello usato l'ultima volta per lo stesso nome, altrimenti le parole chiave, altrimenti "altro". */
export function guessCategory(name: string, stats: Stat[] = []): string {
  const n = normalize(name);
  const known = stats.find((s) => s.name_norm === n);
  if (known) return known.category;
  const padded = ` ${n} `;
  for (const [cat, words] of KEYWORDS) if (words.some((w) => padded.includes(` ${w}`))) return cat;
  return "altro";
}

/** Suggerimenti mentre si scrive: i più usati che iniziano (o contengono una parola che inizia) con il testo, esclusi quelli già in lista. */
export function suggest(stats: Stat[], text: string, onList: Set<string>, limit = 6): Stat[] {
  const q = normalize(text);
  return stats
    .filter((s) => !onList.has(s.name_norm) && (q === "" || s.name_norm.startsWith(q) || s.name_norm.includes(` ${q}`)))
    .sort((a, b) => b.uses - a.uses)
    .slice(0, limit);
}

/** Posizione fra due vicini (ordinamento frazionario): nessun altro elemento cambia. */
export function positionBetween(before?: number, after?: number): number {
  if (before === undefined && after === undefined) return 0;
  if (before === undefined) return after! - 1;
  if (after === undefined) return before + 1;
  // ponytail: dopo ~50 inserimenti nello stesso punto i double finiscono le cifre; rinumerare il reparto se capita.
  return (before + after) / 2;
}

export type Group = { category: string; label: string; items: Item[] };

/** Da comprare raggruppati per reparto (ordine del supermercato, poi posizione); spuntati a parte, gli ultimi in cima. */
export function arrange(items: Item[]): { groups: Group[]; checked: Item[] } {
  const live = items.filter((i) => !i.deleted_at);
  const todo = live.filter((i) => !i.checked).sort((a, b) =>
    (ORDER.get(a.category) ?? 99) - (ORDER.get(b.category) ?? 99) || a.position - b.position || a.name.localeCompare(b.name, "it"));
  const groups: Group[] = [];
  for (const item of todo) {
    const last = groups.at(-1);
    if (last?.category === item.category) last.items.push(item);
    else groups.push({ category: item.category, label: categoryLabel(item.category), items: [item] });
  }
  const checked = live.filter((i) => i.checked).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return { groups, checked };
}

/** Riga arrivata dal server (fetch o realtime): vince la più recente secondo l'orologio del server. */
export function mergeRow(items: Item[], row: Item): Item[] {
  const i = items.findIndex((x) => x.id === row.id);
  if (i === -1) return [...items, row];
  // Date.parse e non confronto fra stringhe: REST e Realtime non formattano i timestamp allo stesso modo.
  if (Date.parse(items[i]!.updated_at) > Date.parse(row.updated_at)) return items;
  return items.with(i, row);
}
