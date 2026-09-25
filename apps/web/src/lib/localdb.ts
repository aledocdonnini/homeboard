import Dexie, { type EntityTable, type Table } from "dexie";
import type { Item, Stat } from "@/features/shopping/items";
import type { Op } from "@/features/shopping/sync";

export type OutboxRow = { seq?: number; household_id: string; op: Op };
export type StatRow = Stat & { household_id: string };
export type MetaRow = { key: string; value: string };

// Copia locale (IndexedDB) di ciò che serve offline, più la coda delle modifiche da inviare.
class LocalDB extends Dexie {
  items!: EntityTable<Item, "id">;
  outbox!: EntityTable<OutboxRow, "seq">;
  stats!: Table<StatRow, [string, string]>;
  meta!: EntityTable<MetaRow, "key">;

  constructor() {
    super("homeboard");
    this.version(1).stores({
      items: "id, household_id",
      outbox: "++seq, household_id",
      stats: "[household_id+name_norm], household_id",
      meta: "key",
    });
  }
}

export const db = new LocalDB();

/** All'uscita dall'account: niente dati di casa lasciati sul dispositivo. */
export const clearLocal = () => Promise.all([db.items.clear(), db.outbox.clear(), db.stats.clear(), db.meta.clear()]);
