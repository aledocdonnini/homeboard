// Timer: il conto alla rovescia come lo si legge (PWA e /casa). I timer veri li tiene brain sul Pi.

/** Secondi che mancano a `endsAt` (mai negativi). */
export const secondsLeft = (endsAt: string | Date, now: Date) => Math.max(0, Math.ceil((new Date(endsAt).getTime() - now.getTime()) / 1000));

/** 605 → "10:05", 3725 → "1:02:05". */
export function countdown(seconds: number): string {
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60;
  const two = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${two(m)}:${two(s)}` : `${two(m)}:${two(s)}`;
}

/** Come lo direbbe Roby: "9 minuti e 41 secondi", "1 ora e 2 minuti", "meno di un secondo". */
export function spoken(seconds: number): string {
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60;
  const part = (n: number, one: string, many: string) => (n ? `${n} ${n === 1 ? one : many}` : "");
  const parts = h ? [part(h, "ora", "ore"), part(m, "minuto", "minuti")] : [part(m, "minuto", "minuti"), part(s, "secondo", "secondi")];
  return parts.filter(Boolean).join(" e ") || "meno di un secondo";
}
