// Livello 1 dell'interprete: regole e modelli di frase in italiano. Istantaneo, niente rete.
// Le regole si provano in ordine: prima le più specifiche ("ferma il timer" prima di "togli il pane").
// Il corpus di frasi in corpus.test.ts è la specifica: una frase nuova da capire, una riga nuova lì.

import { zonedDate } from "@homeboard/core/recurrence";
import { capitalize, itemName, sameThing, Utterance } from "./lexicon.ts";
import type { Context, Intent } from "./schema.ts";
import { resolveWhen, takeDate, takeDuration, takeRecurrence, takeTime, zonedTime } from "./when.ts";

export function parse(text: string, ctx: Context): Intent {
  const u = new Utterance(text);
  // Resti della parola di attivazione e cortesie: "Ehi Roby, per favore puoi aggiungere…, grazie".
  // La trascrizione parte appena scatta la parola, e spesso ne prende la coda: "hai aggiungi il latte".
  u.take(/^[\s,.!?]*(?:(?:ehi|hey|ei|hai|ciao|ok|senti) )?(?:roby|robi|jarvis)\b[\s,.!:]*/);
  u.take(/^\s*(?:(?:hai|ehi|hey|ei|eh|allora|dunque|ok|okay|senti|dai|ecco|allora|beh|mah)\b[\s,.!]*)+(?=\S)/);
  u.take(/^\s*(?:per favore|per piacere|scusa|senti)\b[\s,]*/);
  u.take(/^\s*(?:mi |me lo |ce lo )?(?:puoi|potresti|riesci a|vorrei che|voglio)\s+/);
  u.take(/[\s,]*\b(?:per favore|per piacere|grazie(?: mille)?)[\s.!?]*$/);
  u.take(/[\s.!?]+$/);
  const t = u.text;
  // "Grazie!" da solo: la cortesia in coda l'ha tolto, ma era tutta la frase.
  if (!t) return /grazie|bravo|brava/i.test(text) ? { type: "smalltalk", topic: "thanks" } : { type: "unknown", text };
  const chat = smalltalk(t);
  if (chat) return chat;

  const intent = confirmation(t) ?? timer(u, ctx) ?? note(u) ?? reminder(u, ctx) ?? deadline(u, ctx) ?? shopping(u, ctx) ?? question(u);
  return intent && intent.type !== "unknown" ? intent : { type: "unknown", text };
}

// ——— Chiacchiere ————————————————————————————————————————————————————————————————

function smalltalk(t: string): Intent | null {
  const topic =
    /^(?:ciao|buongiorno|buonasera|buon pomeriggio|salve|ehila|ehi|hey)(?: roby)?$/.test(t) ? "hello"
    : /^(?:come (?:stai|va|te la passi|butta)|tutto (?:bene|ok)|come ti senti)\b/.test(t) ? "how"
    : /^(?:grazie|grazie mille|bravo|brava|perfetto|ottimo|gentilissim[oa])$/.test(t) ? "thanks"
    : /\b(?:che ore sono|che ora e|mi dici l'ora|dimmi l'ora|sai che ore sono)\b/.test(t) ? "time"
    : /\b(?:che giorno e|che giorno e oggi|quanti ne abbiamo|che data e|oggi che giorno e)\b/.test(t) ? "date"
    : /^(?:chi sei|come ti chiami|tu chi sei|chi e roby)\b/.test(t) ? "who"
    : /^(?:cosa sai fare|cosa puoi fare|che cosa sai fare|aiuto|come funzioni|cosa ti posso chiedere)\b/.test(t) ? "help"
    : null;
  return topic ? { type: "smalltalk", topic } : null;
}

// ——— Sì / no ——————————————————————————————————————————————————————————————————

function confirmation(t: string): Intent | null {
  if (/^(?:s[ii](?: s[ii])?(?:,? (?:grazie|certo|confermo|vai|procedi))?|confermo|conferma|certo|certamente|va bene|ok|okay|procedi|vai|fallo|esatto|giusto|d'accordo)$/.test(t)) return { type: "confirm" };
  if (/^(?:no(?: no)?(?:,? grazie)?|annulla|lascia (?:stare|perdere)|niente|non importa|non farlo|meglio di no)$/.test(t)) return { type: "cancel" };
  return null;
}

// ——— Timer ————————————————————————————————————————————————————————————————————

// "Timer" è una parola inglese: la trascrizione italiana (Vosk) la sente spesso come "time", "team", "taimer".
const TIMER = String.raw`(?:timer|taimer|time|team|t'aime|conto alla rovescia|countdown)`;
const known = (said: string, names: string[] = []) => names.find((n) => sameThing(said, n));

function timer(u: Utterance, ctx: Context): Intent | null {
  const t = u.text;
  // Mentre suona: "basta", "stop", "ferma".
  if (/^(?:ok )?(?:basta|stop|ferma|fermo|fermati|zitt[oa]|silenzio|spegni|spegnilo|ho sentito)$/.test(t)) return { type: "timer.stop" };

  const stop = /^(?:ferma|fermare|stoppa|stop|spegni|annulla|cancella|elimina|togli|interrompi|basta con)\b/;
  if (stop.test(t) && new RegExp(`\\b${TIMER}\\b|\\b(?:sveglia|allarme)\\b`).test(t)) {
    u.take(stop);
    u.take(new RegExp(String.raw`\b(?:(?:tutti )?(?:i|il) )?(?:${TIMER}|sveglia|allarme)\b`));
    const label = u.rest();
    return label && !/^tutt[io]$/.test(label) ? { type: "timer.stop", label: known(label, ctx.timers) ?? label } : { type: "timer.stop" };
  }
  if (stop.test(t) && ctx.timers?.length) {
    const probe = new Utterance(t);
    probe.take(stop);
    const label = known(probe.rest(), ctx.timers);
    if (label) return { type: "timer.stop", label };
  }

  // "Quanto manca al timer della pasta?", "quanto manca al bollo?" (quello è una scadenza).
  const howLong = /^(?:e )?(?:quanto (?:tempo )?(?:manca|mancano|resta|restano|rimane|rimangono)|a che punto (?:e|e|sta|siamo)(?: con)?|com'e messo)\b/;
  if (howLong.test(t) || new RegExp(`^quali ${TIMER}|^(?:ci sono )?${TIMER} attivi`).test(t)) {
    u.take(howLong);
    const isTimer = new RegExp(`\\b${TIMER}\\b`).test(u.l);
    u.take(new RegExp(String.raw`\b(?:quali|il|i|al|ai)? ?${TIMER}(?: attivi| ci sono)?\b`));
    const label = u.rest();
    if (!label) return { type: "timer.query" };
    const running = known(label, ctx.timers);
    if (running) return { type: "timer.query", label: running };
    return isTimer ? { type: "timer.query", label } : { type: "deadline.query", title: label };
  }

  // Avvio: serve la parola "timer" (o "avvisami tra…") e una durata.
  const callMe = /\b(?:avvisami|svegliami|chiamami|dimmelo)\b/;
  if (!new RegExp(`\\b${TIMER}\\b`).test(t) && !(callMe.test(t) && /\b(?:tra|fra)\b/.test(t))) return null;
  const seconds = takeDuration(u);
  if (!seconds) return null;
  u.take(/^\s*(?:metti|mettere|imposta|impostare|avvia|avviare|fai partire|parti con|fammi|fai|crea|aggiungi|dammi)?\s*(?:un |il |nuovo )*/);
  u.take(new RegExp(String.raw`\b${TIMER}\b`));
  u.take(callMe);
  u.take(/(?:^|\s)(?:tra|fra)(?=\s|$)/);
  const label = u.rest();
  if (seconds > 86_400) return { type: "unknown", text: "" };
  return label ? { type: "timer.start", seconds, label: label.toLowerCase() } : { type: "timer.start", seconds };
}

// ——— Note ————————————————————————————————————————————————————————————————————

function note(u: Utterance): Intent | null {
  // "Ricorda che…" è una nota; "ricordami di…" è un promemoria.
  const save = u.take(/^(?:ricordati(?! di\b)|ricorda(?!ti| di\b)|tieni a mente|prendi nota|annota|annotati|segnati|memorizza|salva(?: una nota)?|nota)\b(?: (?:che|questo|questa cosa|:))?[\s:,]*/);
  if (!save) return null;
  const body = u.rest("title");
  return body ? { type: "note.save", body: capitalize(body) } : null;
}

function question(u: Utterance): Intent | null {
  const t = u.text;
  // Domande sulle cose annotate: "dove sta la chiave di scorta?", "quando ho cambiato il filtro?".
  if (/^(?:dove|dov'e|dov'e|quando (?:ho|abbiamo|e stat|e stat|hai)|qual e|qual e|quale|quali|chi|come si|cosa sai|che cosa sai|che sai|mi dici|ti ricordi|sai (?:dove|quando|se|come|qual)|ricordi (?:dove|quando|se|come|qual)|che codice|il codice)\b/.test(t)) {
    return { type: "note.ask", question: capitalize(u.o.replace(/\s+/g, " ").trim().replace(/\?+$/, "")) };
  }
  return null;
}

// ——— Promemoria ———————————————————————————————————————————————————————————————

function reminder(u: Utterance, ctx: Context): Intent | null {
  const trigger = /^(?:ricordami|ricordati|ricordarmi|mi ricordi|ricordatemi|ricordaci|avvisami|fammi ricordare|mettimi un promemoria|metti un promemoria|aggiungi un promemoria|crea un promemoria|nuovo promemoria|promemoria)\b[\s:,]*/;
  if (!trigger.test(u.l)) return null;
  u.take(trigger);
  const today = zonedDate(ctx.now, ctx.timezone);
  const repeat = takeRecurrence(u, today);

  // "Tra venti minuti": un istante preciso.
  const inSeconds = !repeat ? takeDuration(u, String.raw`\b(?:tra|fra) (?:circa )?`) : null;
  let when;
  if (inSeconds) {
    const at = new Date(ctx.now.getTime() + inSeconds * 1000);
    when = { date: zonedDate(at, ctx.timezone), time: zonedTime(at, ctx.timezone) };
  } else {
    const day = takeDate(u, today);
    const clock = takeTime(u);
    if (!repeat && !day && !clock) return { type: "unknown", text: "" }; // manca il quando: brain lo chiede
    when = resolveWhen(ctx.now, ctx.timezone, day, clock, repeat);
  }
  // "Ricordami che domani c'è la riunione": il titolo è quello che resta.
  const title = u.rest("title");
  if (!title) return null;
  const date = repeat?.start && repeat.start > when.date ? repeat.start : when.date;
  return {
    type: "reminder.create", title: capitalize(title), date, time: when.time,
    ...(repeat ? { recurrence: repeat.recurrence } : {}),
  };
}

// ——— Scadenze —————————————————————————————————————————————————————————————————

function deadline(u: Utterance, ctx: Context): Intent | null {
  const t = u.text;
  // "Segna che ho pagato la bolletta della luce", "ho pagato il bollo", "segna fatta la revisione".
  const paid = /^(?:segna(?:mi)?(?: che)? )?(?:ho|abbiamo) (?:gia )?(?:pagato|rinnovato|versato|saldato)\b|^segna(?:mi)?(?: come)? (?:pagat|fatt|rinnovat|saldat)[oaie]\b|^segna(?:mi)? che (?:ho|abbiamo) \S+/;
  if (paid.test(t)) {
    u.take(paid);
    const title = u.rest();
    if (title) return { type: "deadline.complete", title: known(title, ctx.deadlines) ?? title };
  }
  // "Ho fatto la revisione": chiude la scadenza se c'è, altrimenti è una cosa da ricordare (nota, più giù).
  const did = /^(?:ho|abbiamo) (?:gia )?(?:fatto|finito|chiuso|sistemato|mandato|spedito|consegnato|rifatto)\b/;
  if (did.test(t) && ctx.deadlines?.length) {
    const probe = new Utterance(t);
    probe.take(did);
    const match = known(probe.rest(), ctx.deadlines);
    if (match) return { type: "deadline.complete", title: match };
  }
  // "Quando scade il bollo?", "quando devo pagare la luce?", "quali scadenze ci sono?".
  const due = /^(?:e )?(?:quando (?:scade|scadono|devo pagare|dobbiamo pagare|va pagat[oa]|c'e|tocca|devo fare|devo rinnovare)|scadenza d(?:el|ella|ello|ell'|ei|egli|elle)|entro quando)\b/;
  if (due.test(t)) {
    u.take(due);
    const title = u.rest();
    return title ? { type: "deadline.query", title: known(title, ctx.deadlines) ?? title } : { type: "deadline.query" };
  }
  if (/\bscadenz[ae]\b|\bcosa scade\b|\bche cosa scade\b|\bscade qualcosa\b/.test(t) && !/^(?:aggiungi|crea|metti|nuova)\b/.test(t)) return { type: "deadline.query" };
  return null;
}

// ——— Spesa ———————————————————————————————————————————————————————————————————

const LIST = String.raw`(?:(?:mia |nostra )?lista(?: della spesa)?|spesa|carrello)`;
const TARGET = new RegExp(String.raw`\s*\b(?:(?:a|alla|nella|sulla|in|nel|sul|dalla|dal|della|dalle|per la)\s+${LIST}|da (?:comprare|prendere))\s*$`);

function items(u: Utterance): string[] {
  u.take(TARGET);
  u.take(new RegExp(String.raw`^(?:in|nella|sulla|alla) ${LIST}\b`));
  return u.rest("name")
    .split(/\s*(?:,|;|\be\b|\bed\b|\bpoi\b|\banche\b|\bpiu\b)\s*/i)
    .map(itemName)
    .filter((s, i, all) => s && all.findIndex((x) => x.toLowerCase() === s.toLowerCase()) === i);
}

function shopping(u: Utterance, ctx: Context): Intent | null {
  const t = u.text;
  if (/^(?:svuota|pulisci|azzera|resetta)\b.*\b(?:lista|spesa|carrello)\b|^(?:cancella|elimina|togli) tutt[oa](?: la)? (?:lista|spesa)?|^togli tutto$|^(?:cancella|elimina|togli) tutto dalla (?:lista|spesa)/.test(t)) {
    return { type: "shopping.clear" };
  }
  if (/^(?:e )?(?:cosa|che cosa|che|cos') ?(?:c'e|ce|ci sta|manca|mancano|serve|servono|devo|dobbiamo|resta|rimane)\b.*(?:comprare|prendere|lista|spesa|manca|mancano|serve|servono|supermercato)|^(?:leggimi|leggi|dimmi|fammi sentire|ripetimi|com'e|mostrami|fammi vedere)(?: la| cosa c'e nella)? (?:lista|spesa)|^(?:la )?lista della spesa$|^(?:cosa|che) (?:manca|serve)$/.test(t)) {
    return { type: "shopping.list" };
  }
  const remove = /^(?:togli|toglimi|togliere|rimuovi|rimuovere|elimina|eliminare|cancella|cancellare|leva|levare|depenna|spunta|ho preso|ho comprato|abbiamo preso|abbiamo comprato|preso)\b/;
  if (remove.test(t)) {
    u.take(remove);
    const list = items(u);
    return list.length ? { type: "shopping.remove", items: list } : null;
  }
  const add = /^(?:aggiungi|aggiungere|aggiungimi|metti|mettere|mettimi|segna|segnami|scrivi|scrivimi|compra|comprare|compriamo|prendi|prendere|devo comprare|dobbiamo comprare|bisogna comprare|bisogna prendere|da comprare|mi serve|mi servono|ci serve|ci servono|serve|servono|manca|mancano|e finito|e finita|sono finiti|sono finite|e finito|e finita|ho finito|abbiamo finito|non c'e piu|non ci sono piu|non abbiamo piu)\b/;
  // "Metti la sveglia alle sette" non è spesa: meglio non capito che una voce sbagliata in lista.
  if (add.test(t) && !/\b(?:alle|domani|sveglia|promemoria|timer|nota)\b/.test(t)) {
    u.take(add);
    const list = items(u);
    return list.length ? { type: "shopping.add", items: list } : null;
  }
  // "Latte e uova alla spesa".
  if (TARGET.test(t)) {
    const list = items(u);
    return list.length ? { type: "shopping.add", items: list } : null;
  }
  // "Ho cambiato il filtro della caldaia": una cosa fatta, da ricordare.
  if (/^(?:ho|abbiamo|oggi ho|ieri ho|oggi abbiamo|ieri abbiamo) (?:gia )?\S+(?:ato|uto|ito|tto|sto|so|to)\b/.test(t)) {
    return { type: "note.save", body: capitalize(u.o.replace(/\s+/g, " ").trim()) };
  }
  // Nel campo della PWA, "latte, uova" senza verbo.
  // Non se comincia come una domanda o un comando: "fai il caffè" non è una cosa da comprare.
  const notAList = /^(?:cosa|come|quando|dove|perche|chi|quanto|qual|che|fai|fammi|accendi|spegni|chiama|apri|chiudi|dimmi|dammi|mostra|cerca|leggi|manda|suona|alza|abbassa|cambia|vai|torna|racconta|canta|ciao|buongiorno|buonasera|grazie)\b/;
  if (ctx.bareIsShopping && t.split(" ").length <= 12 && !notAList.test(t)) {
    const list = items(u);
    return list.length ? { type: "shopping.add", items: list } : null;
  }
  return null;
}
