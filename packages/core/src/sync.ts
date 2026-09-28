// Sincronizzazione offline della lista: logica pura, senza IndexedDB né rete (testata in sync.test.ts).
//
// Come funziona:
//   1. Ogni modifica cambia subito la copia locale e finisce in coda (outbox), in ordine.
//   2. Con la rete, la coda si svuota in ordine; al primo errore di rete ci si ferma e si riprova dopo.
//   3. Poi si scaricano le righe cambiate sul server da `updated_at` in poi.
//
// Conflitti, regole semplici:
//   - Vince l'ultima modifica ARRIVATA al server (il server scrive updated_at). Chi era offline e si
//     ricollega dopo, vince sulle modifiche fatte nel frattempo dagli altri sulla stessa riga.
//   - Una riga arrivata dal server riceve sopra le modifiche locali ancora in coda: finché non partono,
//     sullo schermo resta quello che hai fatto tu.
//   - La cancellazione vince sempre: una cosa tolta dalla lista non torna, e le modifiche in coda su
//     quella riga si scartano.
//   - La stessa cosa aggiunta offline da due telefoni: il server ne tiene una (indice unico sul nome),
//     il secondo inserimento si scarta.
//   - Ogni invio è idempotente: id generati dal client e valori assoluti (checked = true, mai "inverti").

import type { Item } from "./items.ts";

export type Patch = Partial<Pick<Item, "name" | "category" | "checked" | "position" | "deleted_at">>;
export type NewRow = Pick<Item, "id" | "household_id" | "name" | "category" | "position"> & Patch;

/** Un'operazione in coda. I tipi predefiniti sono quelli della spesa; brain usa la stessa coda per tutte le tabelle. */
export type Op<R = NewRow, P = Patch> =
  | { kind: "insert"; itemId: string; row: R }
  | { kind: "update"; itemId: string; patch: P };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyOp = Op<any, any>;

export type Entry<O extends AnyOp = Op> = { seq: number; op: O };

/** Esito di un invio. `retry`: rete o server giù, si riprova; `error`: rifiutato, si scarta. */
export type SendResult = "ok" | "duplicate" | "retry" | { error: string };

// Le righe create in locale nascono "vecchissime": la prima versione del server le sostituisce sempre.
export const LOCAL_TIME = "1970-01-01T00:00:00Z";

/**
 * La copia locale è più recente della riga arrivata? (Arrivi fuori ordine: una fetch lenta dopo il realtime.)
 * Date.parse e non confronto fra stringhe: REST e Realtime non formattano i timestamp allo stesso modo.
 */
export const isNewer = (local: { updated_at: string } | undefined, incoming: { updated_at: string }) =>
  !!local && Date.parse(local.updated_at) > Date.parse(incoming.updated_at);

/** Applica un'operazione a una riga locale (o la crea, se è un inserimento). */
export function applyOp(item: Item | undefined, op: Op): Item | undefined {
  if (op.kind === "insert") {
    return { checked: false, deleted_at: null, updated_at: LOCAL_TIME, ...item, ...op.row };
  }
  return item && { ...item, ...op.patch };
}

/**
 * Riga arrivata dal server + modifiche locali ancora in coda su quella riga.
 * Se il server l'ha cancellata, vince il server.
 */
export function rebase(remote: Item, pending: Op[]): Item {
  if (remote.deleted_at) return remote;
  return pending.filter((op) => op.itemId === remote.id && op.kind === "update")
    .reduce<Item>((row, op) => applyOp(row, op)!, remote);
}

/**
 * Compatta la coda: più modifiche consecutive alla stessa riga diventano una,
 * e le modifiche a una riga non ancora inviata finiscono dentro l'inserimento.
 * L'ordine fra righe diverse resta quello originale.
 */
export function compact<O extends AnyOp>(entries: Entry<O>[]): Entry<O>[] {
  const out: Entry<O>[] = [];
  for (const e of entries) {
    const last = out.findLast((x) => x.op.itemId === e.op.itemId);
    if (last && e.op.kind === "update") {
      const merged = (last.op.kind === "insert"
        ? { ...last.op, row: { ...last.op.row, ...e.op.patch } }
        : { ...last.op, patch: { ...last.op.patch, ...e.op.patch } }) as O;
      out[out.indexOf(last)] = { seq: e.seq, op: merged }; // prende il seq più recente: si cancellano tutti quelli <=
      continue;
    }
    out.push(e);
  }
  return out;
}

/** Le operazioni in coda su righe che il server ha cancellato non servono più. */
export const obsolete = <O extends AnyOp>(entries: Entry<O>[], deletedIds: Set<string>) =>
  entries.filter((e) => e.op.kind === "update" && deletedIds.has(e.op.itemId));

export type FlushReport<O extends AnyOp = Op> = {
  /** Seq inviati (o scartati): tutte le voci di coda con seq <= di questi, per la stessa riga, si tolgono. */
  sent: Entry<O>[];
  /** Inserimenti scartati perché la stessa cosa c'era già: la riga locale va tolta. */
  duplicates: string[];
  errors: { entry: Entry<O>; error: string }[];
  /** true se ci si è fermati per un errore di rete: il resto della coda aspetta. */
  stopped: boolean;
};

/** Svuota la coda in ordine. Al primo errore di rete si ferma, così l'ordine delle modifiche resta quello. */
export async function flush<O extends AnyOp>(entries: Entry<O>[], send: (op: O) => Promise<SendResult>): Promise<FlushReport<O>> {
  const report: FlushReport<O> = { sent: [], duplicates: [], errors: [], stopped: false };
  for (const entry of compact(entries)) {
    const result = await send(entry.op);
    if (result === "retry") {
      report.stopped = true;
      break;
    }
    report.sent.push(entry);
    if (result === "duplicate") report.duplicates.push(entry.op.itemId);
    else if (typeof result === "object") report.errors.push({ entry, error: result.error });
  }
  return report;
}

/**
 * Traduce l'errore di Supabase/PostgREST in cosa fare.
 * - Nessun codice, status 0 o 5xx, JWT scaduto: problema di rete o temporaneo, si riprova.
 * - Chiave primaria già presente ("…_pkey"): l'inserimento era già arrivato (risposta persa), va bene così.
 * - Nome già in lista (indice unico): duplicato da scartare.
 * - Tutto il resto (permessi, vincoli): rifiutato, si scarta e si segnala.
 */
export function classify(error: { code?: string; message: string } | null, status: number): SendResult {
  if (!error) return "ok";
  if (!error.code || status === 0 || status >= 500 || error.code === "PGRST301") return "retry";
  if (error.code === "23505") return error.message.includes("_pkey") ? "ok" : "duplicate";
  return { error: error.message };
}
