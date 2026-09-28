// Le risposte alle chiacchiere: le stesse sul Pi, nella PWA e nel simulatore.

import type { Intent } from "./schema.ts";

type Topic = Extract<Intent, { type: "smalltalk" }>["topic"];

/** L'ora come si dice: "le 15 e 40", "l'una e 5", "mezzogiorno", "le 9 in punto". */
export function spokenTime(now: Date, timezone: string): string {
  const [h, m] = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .format(now).split(":").map(Number) as [number, number];
  if (h === 12 && m === 0) return "mezzogiorno";
  if (h === 0 && m === 0) return "mezzanotte";
  const hour = h === 1 || h === 13 ? "l'una" : `le ${h}`;
  return m === 0 ? `${hour} in punto` : `${hour} e ${m}`;
}

export function smalltalkReply(topic: Topic, now: Date, timezone: string): string {
  switch (topic) {
    case "hello": return "Ciao! Dimmi pure.";
    case "how": return "Bene, grazie. Cosa ti serve?";
    case "thanks": return "Figurati!";
    case "time": {
      const t = spokenTime(now, timezone);
      return `${t.startsWith("mezzo") ? "È" : t.startsWith("l'una") ? "È" : "Sono"} ${t}.`;
    }
    case "date": return `Oggi è ${now.toLocaleDateString("it-IT", { timeZone: timezone, weekday: "long", day: "numeric", month: "long" })}.`;
    case "who": return "Sono Roby, l'assistente di casa.";
    case "help": return "Tengo la lista della spesa, metto i timer, ti ricordo le cose e le scadenze, e mi segno quello che mi dici. Prova con: aggiungi il latte.";
  }
}
