// I timer vivono sul Pi: funzionano senza rete e sopravvivono a un riavvio (salvati nella copia locale).
// Supabase ne riceve solo una copia, perché la PWA possa guardarli (cloud.ts, publishTimers).

import { randomUUID } from "node:crypto";
import type { HomeTimer } from "@homeboard/core/protocol";
import { secondsLeft } from "@homeboard/core/timers";
import { sameThing } from "@homeboard/intents";
import type { Store } from "./store.ts";

/** Un timer che suona e nessuno ferma smette da solo dopo 10 minuti. */
const RING_MAX_MS = 10 * 60_000;

export class Timers {
  private store: Store;
  constructor(store: Store) {
    this.store = store;
  }

  get list(): HomeTimer[] {
    return this.store.get<HomeTimer[]>("timers") ?? [];
  }
  #save(list: HomeTimer[]) {
    this.store.set("timers", list);
  }

  start(seconds: number, label: string | undefined, now: Date): HomeTimer {
    const t: HomeTimer = { id: randomUUID(), label: label ?? null, durationS: seconds, endsAt: new Date(now.getTime() + seconds * 1000).toISOString(), status: "running" };
    this.#save([...this.list, t]);
    return t;
  }

  /** Quelli con quel nome; senza nome, quelli che suonano, altrimenti tutti. */
  find(label?: string): HomeTimer[] {
    const list = this.list;
    if (label) return list.filter((t) => t.label && sameThing(label, t.label));
    const ringing = list.filter((t) => t.status === "ringing");
    return ringing.length ? ringing : list;
  }

  stop(label?: string): HomeTimer[] {
    const drop = this.find(label);
    this.#save(this.list.filter((t) => !drop.some((d) => d.id === t.id)));
    return drop;
  }

  /** Da chiamare spesso: segna "ringing" quelli arrivati a zero, toglie quelli che suonano da troppo. */
  tick(now: Date): { started: HomeTimer[]; expired: HomeTimer[] } {
    const started: HomeTimer[] = [], expired: HomeTimer[] = [];
    const next = this.list.flatMap((t) => {
      if (t.status === "running" && secondsLeft(t.endsAt, now) === 0) {
        started.push(t);
        return [{ ...t, status: "ringing" as const }];
      }
      if (t.status === "ringing" && now.getTime() - new Date(t.endsAt).getTime() > RING_MAX_MS) {
        expired.push(t);
        return [];
      }
      return [t];
    });
    if (started.length || expired.length) this.#save(next);
    return { started, expired };
  }

  get ringing() {
    return this.list.some((t) => t.status === "ringing");
  }
}
