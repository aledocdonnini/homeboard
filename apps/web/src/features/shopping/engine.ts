// Motore di sincronizzazione della lista: collega la logica pura di sync.ts a IndexedDB (Dexie) e a Supabase.
// Le regole sui conflitti sono spiegate in sync.ts.

import { db } from "@/lib/localdb";
import { supabase } from "@/lib/supabase";
import type { Item } from "@homeboard/core/items";
import { applyOp, classify, flush, isNewer, obsolete, rebase, type Entry, type Op, type SendResult } from "@homeboard/core/sync";

export const COLUMNS = "id, household_id, name, category, checked, position, updated_at, deleted_at";
const pullKey = (hid: string) => `pull:${hid}`;
export const errorKey = (hid: string) => `error:${hid}`;

// Le righe salvate hanno sempre il seq (lo assegna Dexie): qui diventano Entry.
const queueOf = async (hid: string) => (await db.outbox.where("household_id").equals(hid).sortBy("seq")) as Entry[];

/** Una modifica fatta qui: cambia subito la copia locale, va in coda, e parte appena c'è rete. */
export async function change(hid: string, ops: Op[]) {
  await db.transaction("rw", db.items, db.outbox, async () => {
    for (const op of ops) {
      const next = applyOp(await db.items.get(op.itemId), op);
      if (next) await db.items.put(next);
      await db.outbox.add({ household_id: hid, op });
    }
  });
  void sync(hid);
}

/** Righe arrivate dal server (download o realtime): entrano nella copia locale con sopra le modifiche in coda. */
export async function receive(hid: string, rows: Item[]) {
  if (!rows.length) return;
  await db.transaction("rw", db.items, db.outbox, async () => {
    const queue = await queueOf(hid);
    const deleted = new Set(rows.filter((r) => r.deleted_at).map((r) => r.id));
    await db.outbox.bulkDelete(obsolete(queue, deleted).map((e) => e.seq));
    const pending = queue.filter((e) => !deleted.has(e.op.itemId)).map((e) => e.op);
    for (const row of rows) {
      if (row.deleted_at) await db.items.delete(row.id);
      else if (!isNewer(await db.items.get(row.id), row)) await db.items.put(rebase(row, pending));
    }
  });
}

async function send(op: Op): Promise<SendResult> {
  try {
    const { error, status } = op.kind === "insert"
      ? await supabase.from("shopping_items").insert(op.row)
      : await supabase.from("shopping_items").update(op.patch).eq("id", op.itemId);
    return classify(error, status);
  } catch {
    return "retry";
  }
}

// Il server dimentica le righe tolte dopo 30 giorni (job notturno): chi non si sincronizza da più di 25
// rifà un download completo, altrimenti non saprebbe di quelle cancellazioni.
const FULL_AFTER_MS = 25 * 86_400_000;

async function pull(hid: string) {
  const pulledAt = (await db.meta.get(`pulledAt:${hid}`))?.value;
  const full = !pulledAt || Date.now() - Date.parse(pulledAt) > FULL_AFTER_MS;
  const since = full ? undefined : (await db.meta.get(pullKey(hid)))?.value;
  let query = supabase.from("shopping_items").select(COLUMNS).eq("household_id", hid);
  // Download completo: solo le righe vive. Altrimenti tutto ciò che è cambiato, cancellazioni comprese.
  query = since ? query.gte("updated_at", since) : query.is("deleted_at", null);
  const [items, stats] = await Promise.all([
    query,
    supabase.from("shopping_item_stats").select("name_norm, name, category, uses").eq("household_id", hid)
      .order("uses", { ascending: false }).limit(200),
  ]);
  if (items.error || stats.error) return; // offline o server giù: riproverà al prossimo giro
  await receive(hid, items.data);
  if (full) {
    // Via le righe locali che il server non ha più (salvo quelle con modifiche ancora in coda).
    const live = new Set(items.data.map((r) => r.id));
    const queued = new Set((await queueOf(hid)).map((e) => e.op.itemId));
    const gone = (await db.items.where("household_id").equals(hid).primaryKeys()).filter((id) => !live.has(id) && !queued.has(id));
    await db.items.bulkDelete(gone);
  }
  const latest = items.data.reduce<string | undefined>((max, r) => (!max || Date.parse(r.updated_at) > Date.parse(max) ? r.updated_at : max), since);
  await db.transaction("rw", db.stats, db.meta, async () => {
    await db.stats.where("household_id").equals(hid).delete();
    await db.stats.bulkPut(stats.data.map((s) => ({ ...s, household_id: hid })));
    await db.meta.put({ key: pullKey(hid), value: latest ?? new Date(0).toISOString() });
    await db.meta.put({ key: `pulledAt:${hid}`, value: new Date().toISOString() });
  });
}

async function run(hid: string) {
  const report = await flush(await queueOf(hid), send);
  await db.transaction("rw", db.items, db.outbox, db.meta, async () => {
    // Una voce compattata copre tutte quelle della stessa riga con seq minore o uguale.
    const queue = await queueOf(hid);
    const done = queue.filter((e) => report.sent.some((s) => s.op.itemId === e.op.itemId && e.seq <= s.seq));
    await db.outbox.bulkDelete(done.map((e) => e.seq));
    await db.items.bulkDelete(report.duplicates);
    if (report.errors.length) await db.meta.put({ key: errorKey(hid), value: report.errors.map((e) => e.error).join("; ") });
    else if (report.sent.length) await db.meta.delete(errorKey(hid));
  });
  if (!report.stopped) await pull(hid);
}

// Un giro alla volta per casa, anche fra più schede (Web Locks); se arrivano modifiche durante un giro, se ne fa un altro.
const running = new Map<string, Promise<void>>();
const dirty = new Set<string>();

export function sync(hid: string): Promise<void> {
  if (running.has(hid)) {
    dirty.add(hid);
    return running.get(hid)!;
  }
  const locked = (fn: () => Promise<void>) =>
    typeof navigator !== "undefined" && navigator.locks ? navigator.locks.request(`shopping-sync:${hid}`, fn) : fn();
  const p = (async () => {
    do {
      dirty.delete(hid);
      await locked(() => run(hid));
    } while (dirty.has(hid));
  })().finally(() => running.delete(hid));
  running.set(hid, p);
  return p;
}

export const pendingCount = (hid: string) => db.outbox.where("household_id").equals(hid).count();
