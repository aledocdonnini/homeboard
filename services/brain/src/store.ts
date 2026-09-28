// La copia locale del Pi, in SQLite (node:sqlite, niente moduli nativi da compilare sul Raspberry).
// Senza internet il Pi funziona lo stesso: si legge e si scrive qui, le modifiche vanno in coda (outbox) e
// partono al ritorno della rete. Stesse regole della PWA (packages/core/src/sync.ts): vince l'ultima modifica
// arrivata al server, la cancellazione vince sempre, le modifiche in coda restano sopra le righe scaricate.
// ponytail: righe salvate come JSON in una tabella sola e filtrate in JS; sono poche centinaia.

import { DatabaseSync } from "node:sqlite";
import { isNewer, LOCAL_TIME, obsolete, type Entry, type FlushReport, type Op } from "@homeboard/core/sync";

export type Table = "shopping_items" | "reminders" | "deadlines" | "notes" | "unparsed_log";
/** Le tabelle che il Pi tiene anche in locale (unparsed_log si scrive e basta). */
export const MIRRORED = ["shopping_items", "reminders", "deadlines", "notes"] as const;
export type Mirrored = (typeof MIRRORED)[number];

export type Row = { id: string; household_id: string; updated_at: string; deleted_at?: string | null; [k: string]: unknown };
export type BrainOp = Op<Record<string, unknown>, Record<string, unknown>> & { table: Table };

// Campi che il server riempirebbe da solo: in locale servono subito.
const DEFAULTS: Partial<Record<Table, Record<string, unknown>>> = {
  shopping_items: { checked: false, category: "altro", position: 0 },
  deadlines: { done_at: null, category: "altro", notify_days: [7, 0] },
  notes: { source: "voce", created_at: new Date(0).toISOString() },
};

export class Store {
  readonly db: DatabaseSync;

  constructor(path = ":memory:") {
    this.db = new DatabaseSync(path);
    this.db.exec(`
      pragma journal_mode = wal;
      create table if not exists kv (key text primary key, value text not null);
      create table if not exists rows (tbl text not null, id text not null, data text not null, primary key (tbl, id));
      create table if not exists outbox (seq integer primary key autoincrement, tbl text not null, op text not null);
    `);
  }

  // ——— Chiave/valore: sessione, casa, cursori, timer ———
  get<T>(key: string): T | null {
    const r = this.db.prepare("select value from kv where key = ?").get(key) as { value: string } | undefined;
    return r ? (JSON.parse(r.value) as T) : null;
  }
  set(key: string, value: unknown) {
    if (value === null || value === undefined) this.db.prepare("delete from kv where key = ?").run(key);
    else this.db.prepare("insert into kv (key, value) values (?, ?) on conflict (key) do update set value = excluded.value").run(key, JSON.stringify(value));
  }

  // ——— Righe ———
  all(table: Mirrored): Row[] {
    return (this.db.prepare("select data from rows where tbl = ?").all(table) as { data: string }[]).map((r) => JSON.parse(r.data) as Row);
  }
  /** Le righe vive (non cancellate). */
  live(table: Mirrored): Row[] {
    return this.all(table).filter((r) => !r.deleted_at);
  }
  row(table: Mirrored, id: string): Row | undefined {
    const r = this.db.prepare("select data from rows where tbl = ? and id = ?").get(table, id) as { data: string } | undefined;
    return r ? (JSON.parse(r.data) as Row) : undefined;
  }
  #put(table: string, row: Row) {
    this.db.prepare("insert into rows (tbl, id, data) values (?, ?, ?) on conflict (tbl, id) do update set data = excluded.data").run(table, row.id, JSON.stringify(row));
  }
  #drop(table: string, id: string) {
    this.db.prepare("delete from rows where tbl = ? and id = ?").run(table, id);
  }
  #tx(fn: () => void) {
    this.db.exec("begin");
    try { fn(); this.db.exec("commit"); } catch (e) { this.db.exec("rollback"); throw e; }
  }

  /** Una modifica fatta qui: cambia subito la copia locale e va in coda per il server. */
  change(ops: BrainOp[]) {
    this.#tx(() => {
      for (const op of ops) {
        if (op.table !== "unparsed_log") {
          const current = this.row(op.table, op.itemId);
          const next = op.kind === "insert"
            ? { deleted_at: null, updated_at: LOCAL_TIME, ...DEFAULTS[op.table], ...current, ...op.row } as Row
            : current && { ...current, ...op.patch };
          if (next) this.#put(op.table, next);
        }
        this.db.prepare("insert into outbox (tbl, op) values (?, ?)").run(op.table, JSON.stringify(op));
      }
    });
  }

  queue(): Entry<BrainOp>[] {
    return (this.db.prepare("select seq, op from outbox order by seq").all() as { seq: number; op: string }[])
      .map((r) => ({ seq: r.seq, op: JSON.parse(r.op) as BrainOp }));
  }

  /** Righe arrivate dal server (download o realtime): entrano con sopra le modifiche ancora in coda. */
  receive(table: Mirrored, rows: Row[]) {
    if (!rows.length) return;
    this.#tx(() => {
      const queue = this.queue();
      const deleted = new Set(rows.filter((r) => r.deleted_at).map((r) => r.id));
      for (const e of obsolete(queue, deleted)) this.db.prepare("delete from outbox where seq = ?").run(e.seq);
      const pending = queue.filter((e) => e.op.kind === "update" && !deleted.has(e.op.itemId));
      for (const row of rows) {
        if (row.deleted_at) this.#drop(table, row.id);
        else if (!isNewer(this.row(table, row.id), row)) {
          const mine = pending.filter((e) => e.op.itemId === row.id).map((e) => (e.op.kind === "update" ? e.op.patch : {}));
          this.#put(table, Object.assign({ ...row }, ...mine));
        }
      }
    });
  }

  /** Download completo: via le righe locali che il server non ha più, salvo quelle ancora in coda. */
  keepOnly(table: Mirrored, liveIds: Set<string>) {
    const queued = new Set(this.queue().map((e) => e.op.itemId));
    for (const r of this.all(table)) if (!liveIds.has(r.id) && !queued.has(r.id)) this.#drop(table, r.id);
  }

  /** Dopo un invio: via dalla coda ciò che è partito; i doppioni rifiutati spariscono anche in locale. */
  sent(report: FlushReport<BrainOp>) {
    this.#tx(() => {
      for (const e of this.queue()) {
        if (report.sent.some((s) => s.op.itemId === e.op.itemId && e.seq <= s.seq)) this.db.prepare("delete from outbox where seq = ?").run(e.seq);
      }
      for (const s of report.sent) if (report.duplicates.includes(s.op.itemId) && s.op.table !== "unparsed_log") this.#drop(s.op.table, s.op.itemId);
    });
  }

  /** Il Pi è stato scollegato dalla casa: via i dati, resta solo la sessione. */
  forget() {
    this.#tx(() => {
      this.db.exec("delete from rows; delete from outbox;");
      this.db.prepare("delete from kv where key not like 'auth:%'").run();
    });
  }
}
