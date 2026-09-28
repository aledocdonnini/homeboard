// Il corpus dell'interprete: frase → intento atteso. È la specifica delle regole.
// Una frase che Roby non capisce (unparsed_log) diventa una riga qui, poi si sistema la regola.
// Adesso: lunedì 28 settembre 2026, 10:00 a Roma.

import { test } from "node:test";
import assert from "node:assert/strict";
import { parse, type Context, type Intent } from "./index.ts";

const ctx: Context = { now: new Date("2026-09-28T08:00:00Z"), timezone: "Europe/Rome" };
const add = (...items: string[]): Intent => ({ type: "shopping.add", items });
const remove = (...items: string[]): Intent => ({ type: "shopping.remove", items });
const timer = (seconds: number, label?: string): Intent => ({ type: "timer.start", seconds, ...(label ? { label } : {}) });
const remind = (title: string, date: string, time: string, recurrence?: Extract<Intent, { type: "reminder.create" }>["recurrence"]): Intent =>
  ({ type: "reminder.create", title, date, time, ...(recurrence ? { recurrence } : {}) });
const unknown = (text: string): Intent => ({ type: "unknown", text });

const CORPUS: [string, Intent, Partial<Context>?][] = [
  // ——— Spesa: aggiungere ———
  ["aggiungi latte e uova alla spesa", add("Latte", "Uova")],
  ["Ehi Roby, aggiungi il pane", add("Pane")],
  ["roby aggiungi il latte", add("Latte")],
  ["aggiungi il latte alla lista della spesa", add("Latte")],
  ["metti le uova nella lista", add("Uova")],
  ["compra i biscotti", add("Biscotti")],
  ["mi serve il detersivo per i piatti", add("Detersivo per i piatti")],
  ["manca il caffè", add("Caffè")],
  ["è finito lo zucchero", add("Zucchero")],
  ["abbiamo finito la carta igienica", add("Carta igienica")],
  ["non c'è più il pane", add("Pane")],
  ["dobbiamo comprare le pile", add("Pile")],
  ["aggiungi due litri di latte", add("2 litri di latte")],
  ["aggiungi sei uova e un chilo di farina", add("6 uova", "1 chilo di farina")],
  ["puoi aggiungere pomodori, basilico e mozzarella?", add("Pomodori", "Basilico", "Mozzarella")],
  ["aggiungi il sale e il pepe", add("Sale", "Pepe")],
  ["aggiungi un po' di pane", add("Pane")],
  ["aggiungi anche l'olio", add("Olio")],
  ["aggiungi lo shampoo per favore", add("Shampoo")],
  ["segna il parmigiano", add("Parmigiano")],
  ["aggiungi latte, Latte", add("Latte")],
  ["latte e uova alla spesa", add("Latte", "Uova")],
  ["Aggiungi il Nesquik", add("Nesquik")],
  ["aggiungi il caffè alla lista", add("Caffè")],
  ["metti in lista il tonno", add("Tonno")],
  ["segnami le mele", add("Mele")],
  ["aggiungi 2 pacchi di pasta", add("2 pacchi di pasta")],

  // ——— Spesa: togliere, leggere, svuotare ———
  ["togli il pane", remove("Pane")],
  ["togli il pane dalla lista", remove("Pane")],
  ["rimuovi latte e uova dalla spesa", remove("Latte", "Uova")],
  ["ho preso il latte", remove("Latte")],
  ["cancella le zucchine", remove("Zucchine")],
  ["ho comprato il pane e il latte", remove("Pane", "Latte")],
  ["togli la pasta dalla lista della spesa", remove("Pasta")],
  ["cosa c'è da comprare", { type: "shopping.list" }],
  ["cosa manca da comprare?", { type: "shopping.list" }],
  ["cosa manca?", { type: "shopping.list" }],
  ["che cosa c'è nella lista della spesa?", { type: "shopping.list" }],
  ["leggimi la lista", { type: "shopping.list" }],
  ["cosa devo comprare", { type: "shopping.list" }],
  ["cosa serve al supermercato", { type: "shopping.list" }],
  ["la lista della spesa", { type: "shopping.list" }],
  ["svuota la lista", { type: "shopping.clear" }],
  ["cancella tutta la lista", { type: "shopping.clear" }],
  ["togli tutto", { type: "shopping.clear" }],

  // ——— Timer ———
  ["timer pasta dieci minuti", timer(600, "pasta")],
  ["metti un timer di dieci minuti per la pasta", timer(600, "pasta")],
  ["timer per la pasta di dieci minuti", timer(600, "pasta")],
  ["imposta un timer di 5 minuti", timer(300)],
  ["timer di un'ora e mezza per l'arrosto", timer(5400, "arrosto")],
  ["timer mezz'ora", timer(1800)],
  ["timer un quarto d'ora", timer(900)],
  ["fai partire un timer di venti secondi", timer(20)],
  ["timer due ore e dieci minuti", timer(7800)],
  ["timer ventitré minuti", timer(1380)],
  ["timer 1 ora e 20", timer(4800)],
  ["ehi roby metti un timer di tre minuti per le uova", timer(180, "uova")],
  ["avvisami tra venti minuti", timer(1200)],
  ["fra dieci minuti avvisami", timer(600)],
  ["avvisami tra dieci minuti di spegnere il forno", timer(600, "spegnere il forno")],
  ["imposta un conto alla rovescia di 3 minuti", timer(180)],
  ["timer tè 4 minuti", timer(240, "tè")],
  ["timer di 90 secondi", timer(90)],
  // Come li trascrive Vosk (bench di services/voice).
  ["time passa dieci minuti", timer(600, "passa")],
  ["metti un team di venti minuti per il forno", timer(1200, "forno")],
  ["quanto manca time", { type: "timer.query" }],
  ["ferma il time", { type: "timer.stop" }],
  ["quanto manca al timer?", { type: "timer.query" }],
  ["quanto manca?", { type: "timer.query" }],
  ["quanto manca al timer della pasta", { type: "timer.query", label: "pasta" }],
  ["quanto manca alla pasta?", { type: "timer.query", label: "pasta" }, { timers: ["pasta"] }],
  ["quali timer ci sono", { type: "timer.query" }],
  ["ferma il timer", { type: "timer.stop" }],
  ["ferma il timer della pasta", { type: "timer.stop", label: "pasta" }],
  ["annulla il timer del forno", { type: "timer.stop", label: "forno" }],
  ["ferma tutti i timer", { type: "timer.stop" }],
  ["ferma la pasta", { type: "timer.stop", label: "pasta" }, { timers: ["pasta"] }],
  ["stop", { type: "timer.stop" }],
  ["basta!", { type: "timer.stop" }],

  // ——— Promemoria ———
  ["ricordami domani alle nove di chiamare l'idraulico", remind("Chiamare l'idraulico", "2026-09-29", "09:00")],
  ["ricordami di chiamare l'idraulico domani alle nove", remind("Chiamare l'idraulico", "2026-09-29", "09:00")],
  ["Ricordami domani alle tre di passare in banca", remind("Passare in banca", "2026-09-29", "15:00")],
  ["ricordami alle otto di buttare la plastica", remind("Buttare la plastica", "2026-09-28", "20:00")],
  ["ricordami alle 11 di chiamare Marco", remind("Chiamare Marco", "2026-09-28", "11:00")],
  ["ricordami alle 9:30 di uscire", remind("Uscire", "2026-09-28", "21:30")],
  ["ricordami alle nove di sera di prendere la pillola", remind("Prendere la pillola", "2026-09-28", "21:00")],
  ["ricordami alle nove e mezza di sera di spegnere il forno", remind("Spegnere il forno", "2026-09-28", "21:30")],
  ["ricordami stasera di chiudere il gas", remind("Chiudere il gas", "2026-09-28", "20:00")],
  ["ricordami a mezzogiorno di mettere su l'acqua", remind("Mettere su l'acqua", "2026-09-28", "12:00")],
  ["ricordami tra venti minuti di girare l'arrosto", remind("Girare l'arrosto", "2026-09-28", "10:20")],
  ["ricordami tra due ore di stendere", remind("Stendere", "2026-09-28", "12:00")],
  ["ricordami venerdì alle 18 di comprare il regalo", remind("Comprare il regalo", "2026-10-02", "18:00")],
  ["ricordami lunedì di pagare l'affitto", remind("Pagare l'affitto", "2026-10-05", "09:00")],
  ["ricordami il 5 ottobre di rinnovare il passaporto", remind("Rinnovare il passaporto", "2026-10-05", "09:00")],
  ["ricordami il 3 di pagare la retta", remind("Pagare la retta", "2026-10-03", "09:00")],
  ["ricordami dopodomani alle 17 di ritirare il pacco", remind("Ritirare il pacco", "2026-09-30", "17:00")],
  ["ricordami tra tre giorni di richiamare il medico", remind("Richiamare il medico", "2026-10-01", "09:00")],
  ["ricordami la prossima settimana di prenotare il tagliando", remind("Prenotare il tagliando", "2026-10-05", "09:00")],
  ["ricordami domattina di annaffiare le piante", remind("Annaffiare le piante", "2026-09-29", "09:00")],
  ["ricordami domani sera alle otto di chiamare Luca", remind("Chiamare Luca", "2026-09-29", "20:00")],
  ["ricordati di chiamare la nonna domani", remind("Chiamare la nonna", "2026-09-29", "09:00")],
  ["ricordami venerdì 9 ottobre alle 20 di andare a teatro", remind("Andare a teatro", "2026-10-09", "20:00")],
  ["ricordami giovedì alle 8 e un quarto di portare il cane dal veterinario", remind("Portare il cane dal veterinario", "2026-10-01", "08:15")],
  ["ricordami il 31 di pagare", remind("Pagare", "2026-09-30", "09:00")],
  ["ricordami alle 15 della riunione", remind("Riunione", "2026-09-28", "15:00")],
  ["ricordami tra un'ora di togliere la torta", remind("Togliere la torta", "2026-09-28", "11:00")],
  ["mi ricordi domani di portare la macchina dal meccanico", remind("Portare la macchina dal meccanico", "2026-09-29", "09:00")],
  ["ricordami ogni 15 del mese di pagare la carta", remind("Pagare la carta", "2026-10-15", "09:00", { freq: "month", interval: 1 })],
  ["promemoria: domani alle 10 dentista", remind("Dentista", "2026-09-29", "10:00")],
  ["ricordami ogni lunedì alle otto di portare fuori la plastica",
    remind("Portare fuori la plastica", "2026-09-28", "08:00", { freq: "week", interval: 1, byWeekday: [0] })],
  ["ricordami tutti i martedì e giovedì alle 18 di andare in palestra",
    remind("Andare in palestra", "2026-09-28", "18:00", { freq: "week", interval: 1, byWeekday: [1, 3] })],
  ["ricordami ogni giorno alle 7 di prendere la pastiglia", remind("Prendere la pastiglia", "2026-09-28", "07:00", { freq: "day", interval: 1 })],
  ["ricordami ogni primo del mese di pagare l'affitto", remind("Pagare l'affitto", "2026-10-01", "09:00", { freq: "month", interval: 1 })],
  ["ricordami il primo di ogni mese di pagare l'affitto", remind("Pagare l'affitto", "2026-10-01", "09:00", { freq: "month", interval: 1 })],
  ["ricordami ogni anno il 12 marzo il compleanno di Anna", remind("Il compleanno di Anna", "2027-03-12", "09:00", { freq: "year", interval: 1 })],
  ["ricordami ogni due settimane di cambiare le lenzuola", remind("Cambiare le lenzuola", "2026-09-28", "09:00", { freq: "week", interval: 2 })],

  // ——— Scadenze ———
  ["quando scade il bollo?", { type: "deadline.query", title: "bollo" }],
  ["quando scade l'assicurazione della macchina", { type: "deadline.query", title: "assicurazione della macchina" }],
  ["quando devo pagare la bolletta della luce?", { type: "deadline.query", title: "bolletta della luce" }],
  ["quanto manca al bollo?", { type: "deadline.query", title: "bollo" }],
  ["quali scadenze ci sono?", { type: "deadline.query" }],
  ["cosa scade questo mese", { type: "deadline.query" }],
  ["segna che ho pagato la bolletta della luce", { type: "deadline.complete", title: "bolletta della luce" }],
  ["ho pagato il bollo", { type: "deadline.complete", title: "bollo" }],
  ["segna fatta la revisione", { type: "deadline.complete", title: "revisione" }],
  ["ho fatto la revisione", { type: "deadline.complete", title: "Revisione auto" }, { deadlines: ["Revisione auto", "Bollo"] }],
  ["ho pagato la luce", { type: "deadline.complete", title: "Bolletta della luce" }, { deadlines: ["Bolletta della luce"] }],

  // ——— Note ———
  ["ricorda che la chiave di scorta è da mia madre", { type: "note.save", body: "La chiave di scorta è da mia madre" }],
  ["prendi nota: il codice del cancello è 4512", { type: "note.save", body: "Il codice del cancello è 4512" }],
  ["annota che la garanzia della lavatrice scade a marzo", { type: "note.save", body: "La garanzia della lavatrice scade a marzo" }],
  ["ho cambiato il filtro della caldaia", { type: "note.save", body: "Ho cambiato il filtro della caldaia" }],
  ["ho fatto la revisione", { type: "note.save", body: "Ho fatto la revisione" }],
  ["dove sta la chiave di scorta?", { type: "note.ask", question: "Dove sta la chiave di scorta" }],
  ["dov'è la chiave di scorta", { type: "note.ask", question: "Dov'è la chiave di scorta" }],
  ["quando ho cambiato il filtro?", { type: "note.ask", question: "Quando ho cambiato il filtro" }],
  ["qual è il codice del cancello?", { type: "note.ask", question: "Qual è il codice del cancello" }],

  // ——— Sì e no ———
  ["sì", { type: "confirm" }],
  ["si", { type: "confirm" }],
  ["Sì, confermo", { type: "confirm" }],
  ["va bene", { type: "confirm" }],
  ["no", { type: "cancel" }],
  ["no grazie", { type: "cancel" }],
  ["annulla", { type: "cancel" }],
  ["lascia stare", { type: "cancel" }],

  // ——— Sbagliate, ambigue, fuori tema: meglio non capite che fatte male ———
  ["", unknown("")],
  ["Roby", unknown("Roby")],
  ["che tempo fa domani", unknown("che tempo fa domani")],
  ["accendi la luce", unknown("accendi la luce")],
  ["bla bla bla", unknown("bla bla bla")],
  ["aggiungi", unknown("aggiungi")],
  ["metti un timer", unknown("metti un timer")],
  ["timer", unknown("timer")],
  ["timer di cinquanta ore", unknown("timer di cinquanta ore")],
  ["metti la sveglia alle sette", unknown("metti la sveglia alle sette")],
  ["ricordami di comprare il latte", unknown("ricordami di comprare il latte")],
  ["cosa c'è domani", unknown("cosa c'è domani")],
  ["cosa?", unknown("cosa?")],
  ["allora", unknown("allora")],

  // ——— Viste: cambiano la parte centrale dello schermo ———
  ["mostrami i promemoria", { type: "show", view: "reminders" }],
  ["fammi vedere la spesa", { type: "show", view: "shopping" }],
  ["mostrami la lista della spesa", { type: "show", view: "shopping" }],
  ["apri le scadenze", { type: "show", view: "deadlines" }],
  ["fammi vedere le note", { type: "show", view: "notes" }],
  ["mostrami i timer", { type: "show", view: "timers" }],
  ["torna a oggi", { type: "show", view: "today" }],
  ["cosa c'è oggi?", { type: "show", view: "today" }],
  ["cosa devo fare oggi", { type: "show", view: "today" }],
  ["che promemoria ho?", { type: "show", view: "reminders" }],
  ["ehi roby mostrami le mie note", { type: "show", view: "notes" }],
  ["apri le impostazioni", { type: "show", view: "settings" }],
  ["mostrami il gatto", unknown("mostrami il gatto")],

  // ——— Chiacchiere e resti della parola di attivazione ———
  ["hai aggiungi il latte", add("Latte")],
  ["ehi allora aggiungi il pane", add("Pane")],
  ["jarvis timer pasta dieci minuti", timer(600, "pasta")],
  ["come stai", { type: "smalltalk", topic: "how" }],
  ["come va", { type: "smalltalk", topic: "how" }],
  ["ciao", { type: "smalltalk", topic: "hello" }],
  ["buongiorno roby", { type: "smalltalk", topic: "hello" }],
  ["grazie", { type: "smalltalk", topic: "thanks" }],
  ["Roby, che ore sono?", { type: "smalltalk", topic: "time" }],
  ["che giorno è oggi", { type: "smalltalk", topic: "date" }],
  ["chi sei", { type: "smalltalk", topic: "who" }],
  ["cosa sai fare?", { type: "smalltalk", topic: "help" }],
  ["latte e uova", unknown("latte e uova")],

  // ——— Il campo di testo della PWA: senza verbo è spesa ———
  ["latte, uova, pane", add("Latte", "Uova", "Pane"), { bareIsShopping: true }],
  ["Latte e uova", add("Latte", "Uova"), { bareIsShopping: true }],
  ["come stai?", { type: "smalltalk", topic: "how" }, { bareIsShopping: true }],
  ["fai il caffè", unknown("fai il caffè"), { bareIsShopping: true }],
  ["accendi la luce", unknown("accendi la luce"), { bareIsShopping: true }],
  ["pane integrale", add("Pane integrale"), { bareIsShopping: true }],
  ["detersivo per i piatti, latte", add("Detersivo per i piatti", "Latte"), { bareIsShopping: true }],
  ["stasera finisce la farina di riso, pensaci tu", unknown("stasera finisce la farina di riso, pensaci tu"), { bareIsShopping: true }],
  ["ricordami domani alle 9 di chiamare Anna", remind("Chiamare Anna", "2026-09-29", "09:00"), { bareIsShopping: true }],
];

for (const [text, expected, extra] of CORPUS) {
  test(`«${text}»`, () => assert.deepEqual(parse(text, { ...ctx, ...extra }), expected));
}

test("risposte alle chiacchiere", async () => {
  const { smalltalkReply, spokenTime } = await import("./smalltalk.ts");
  assert.equal(spokenTime(new Date("2026-09-28T13:40:00Z"), "Europe/Rome"), "le 15 e 40");
  assert.equal(spokenTime(new Date("2026-09-28T11:05:00Z"), "Europe/Rome"), "l'una e 5");
  assert.equal(smalltalkReply("time", new Date("2026-09-28T10:00:00Z"), "Europe/Rome"), "È mezzogiorno.");
  assert.equal(smalltalkReply("time", new Date("2026-09-28T07:00:00Z"), "Europe/Rome"), "Sono le 9 in punto.");
  assert.equal(smalltalkReply("date", ctx.now, "Europe/Rome"), "Oggi è lunedì 28 settembre.");
});
