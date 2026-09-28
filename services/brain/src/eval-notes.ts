// Valutazione della ricerca nelle note col modello vero: npm run eval:note -w @homeboard/brain
// Per ritarare THRESHOLD (notes.ts) sul Pi o dopo aver cambiato modello. Le domande con null non hanno una nota.
import { index, loadEmbedder, search, SURE, THRESHOLD } from "./notes.ts";
import { Store } from "./store.ts";

const NOTES = [
  "La chiave di scorta è da mia madre", "Ho cambiato il filtro della caldaia", "Il codice del cancello è 4512",
  "La garanzia della lavatrice scade a marzo 2027", "Il wifi degli ospiti è casa2026", "L'idraulico si chiama Marco, 333 1234567",
  "Le batterie di ricambio sono nel cassetto della cucina", "Il tagliando della macchina l'ho fatto a 45000 km",
  "Ricetta tiramisù: 500g mascarpone, 4 uova\nhttps://esempio.it/tiramisu",
];
const CASES: [string, number | null][] = [
  ["dove sta la chiave di riserva?", 0], ["quando ho cambiato il filtro?", 1], ["qual è il codice per aprire il cancello?", 2],
  ["fino a quando è coperta la lavatrice?", 3], ["qual è la password del wifi per gli ospiti?", 4], ["come si chiama l'idraulico?", 5],
  ["dove sono le pile?", 6], ["a che chilometri ho fatto il tagliando?", 7], ["numero dell'idraulico", 5],
  ["cosa mi serve per il tiramisù?", 8], ["ingredienti del tiramisù", 8],
  // Domande "vicine" senza la loro nota: il modello piccolo ci casca, Roby deve almeno dire "forse".
  ["dove ho messo il passaporto?", null], ["dove ho messo il caricabatterie?", null], ["quando scade la patente?", null], ["che tempo fa domani?", null], ["quanto costa il pane?", null],
];

const store = new Store();
store.receive("notes", NOTES.map((body, i) => ({ id: String(i), household_id: "h", body, source: "voce", created_at: "2026-09-28T08:00:00Z", updated_at: "2026-09-28T08:00:00Z", deleted_at: null })));
const embedder = await loadEmbedder();
await index(store, embedder);
let ok = 0;
for (const [q, expected] of CASES) {
  const found = await search(store, q, embedder);
  const got = found ? Number(found.note.id) : null;
  ok += got === expected ? 1 : 0;
  const mark = got === expected ? "✓" : found && found.score < SURE ? "~" : "✗";
  console.log(`${mark} ${q.padEnd(44)} ${found ? found.score.toFixed(2) : " -  "} ${got === null ? "(niente)" : NOTES[got]!.split("\n")[0]}`);
}
console.log(`\n${ok}/${CASES.length} giuste (~ = sbagliata ma detta con "forse"), soglia ${THRESHOLD}, sicura da ${SURE}`);
