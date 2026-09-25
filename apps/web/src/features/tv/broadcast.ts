// Palinsesto della TV: quando è notte, quando non c'è niente da mostrare, e cosa dice Roby. Puro, testato.
import type { DashData } from "./Cruscotto";

/** Orari "HH:MM". La notte può scavalcare la mezzanotte (23:30 → 07:00). */
export const isNight = (time: string, start: string, end: string) =>
  start <= end ? time >= start && time < end : time >= start || time < end;

/** Niente di rilevante: nessuna scadenza entro 30 giorni, nessun promemoria oggi, lista vuota → monoscopio. */
export const nothingOnAir = (d: DashData) =>
  !d.deadlines.some((x) => x.daysLeft <= 30) && d.reminders.length === 0 && d.shopping.todo.length === 0;

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const list = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} e ${xs.at(-1)}`);

function deadlineSentence(title: string, n: number) {
  if (n < 0) return `${title} è scaduta da ${-n} ${n === -1 ? "giorno" : "giorni"}.`;
  if (n === 0) return `${title} scade oggi.`;
  if (n === 1) return `${title} scade domani.`;
  return `${title} scade tra ${n} giorni.`;
}

/** Il riepilogo che Roby legge sul canale 6: saluto, scadenze vicine, prossimo promemoria, spesa. */
export function summary(d: DashData, hour: number): string {
  const out = [hour < 12 ? "Buongiorno." : hour < 18 ? "Buon pomeriggio." : "Buonasera."];
  for (const x of d.deadlines.filter((x) => x.daysLeft <= 7).slice(0, 2)) out.push(deadlineSentence(x.title, x.daysLeft));
  const r = d.reminders[0];
  if (r) out.push(`Alle ${r.time}: ${lower(r.title)}.`);
  const todo = d.shopping.todo.map(lower);
  if (todo.length === 0) out.push("La lista della spesa è vuota.");
  else if (todo.length === 1) out.push(`In lista c'è solo ${todo[0]}.`);
  else if (todo.length <= 3) out.push(`In lista: ${list(todo)}.`);
  else out.push(`In lista ci sono ${todo.length} cose: ${todo.slice(0, 2).join(", ")} e altre ${todo.length - 2}.`);
  return out.join(" ");
}
