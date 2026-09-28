// Il Pi e Supabase: sessione del dispositivo, abbinamento, coda in uscita, download, realtime, battito.
// Il Pi è un utente anonimo abbinato alla casa con un codice (claim_pairing dalla PWA): legge tutto e scrive
// i dati di tutti i giorni (policy in supabase/migrations/20260929090000_home_assistant.sql).
// Senza rete non si ferma niente: si riprova e intanto si lavora sulla copia locale.

import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import type { HomeTimer } from "@homeboard/core/protocol";
import { classify, flush, type SendResult } from "@homeboard/core/sync";
import type { Household } from "./state.ts";
import { MIRRORED, type BrainOp, type Mirrored, type Row, type Store } from "./store.ts";

const COLUMNS: Record<Mirrored, string> = {
  shopping_items: "id, household_id, name, category, checked, position, created_by, updated_at, deleted_at",
  reminders: "*",
  deadlines: "*",
  notes: "id, household_id, body, source, created_at, updated_at, deleted_at",
};
/** Il server dimentica le righe tolte dopo 30 giorni: chi non si sincronizza da più di 25 rifà tutto. */
const FULL_AFTER_MS = 25 * 86_400_000;
const CODE_REFRESH_MS = 9 * 60_000;
const PAIR_POLL_MS = 3_000;
const BEAT_MS = 60_000;
const RETRY_MS = 30_000;

export type CloudEvents = {
  /** Qualcosa è cambiato (dati, casa, rete, codice): si ridisegna /casa. */
  changed(): void;
  /** Qualcuno dal telefono ha aggiunto alla spesa. */
  arrived(name: string): void;
};

export class Cloud {
  readonly client;
  online = false;
  pairing: { code: string; expiresAt: string } | null = null;
  #uid = "";
  #channel?: RealtimeChannel;
  #timers: ReturnType<typeof setInterval>[] = [];
  #syncing?: Promise<void>;
  #again = false;

  private store: Store;
  private events: CloudEvents;

  constructor(store: Store, url: string, key: string, events: CloudEvents) {
    this.store = store;
    this.events = events;
    // La sessione del dispositivo sta nella copia locale: sopravvive ai riavvii, come in un browser.
    const storage = {
      getItem: (k: string) => store.get<string>(`auth:${k}`),
      setItem: (k: string, v: string) => store.set(`auth:${k}`, v),
      removeItem: (k: string) => store.set(`auth:${k}`, null),
    };
    this.client = createClient(url, key, { auth: { storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
  }

  get household() {
    return this.store.get<Household>("household");
  }

  async start() {
    await this.#identify();
    this.#timers.push(setInterval(() => void this.#beat(), BEAT_MS), setInterval(() => void this.sync(), RETRY_MS));
  }

  stop() {
    for (const t of this.#timers) clearInterval(t);
    if (this.#channel) void this.client.removeChannel(this.#channel);
  }

  #setOnline(online: boolean) {
    if (online === this.online) return;
    this.online = online;
    this.events.changed();
    if (online) void this.sync();
  }

  /** Chi sono e di che casa sono. Senza sessione: una anonima nuova. Senza casa: si mostra il codice. */
  async #identify(): Promise<void> {
    try {
      let { data: { session } } = await this.client.auth.getSession();
      if (!session) {
        const { data, error } = await this.client.auth.signInAnonymously();
        if (error) throw error;
        session = data.session;
      }
      this.#uid = session!.user.id;
      const { data, error } = await this.client.from("devices").select("households(id, name, timezone, night_start, night_end)").eq("user_id", this.#uid).maybeSingle();
      if (error) throw error;
      this.#setOnline(true);
      const house = (data?.households ?? null) as Household | null;
      if (!house) return this.#pair();
      const was = this.household;
      if (was && was.id !== house.id) this.store.forget();
      this.store.set("household", house);
      this.pairing = null;
      this.events.changed();
      this.#listen(house.id);
      await this.sync();
    } catch (e) {
      console.warn("Supabase non raggiungibile:", (e as Error).message);
      this.#setOnline(false);
      setTimeout(() => void this.#identify(), RETRY_MS);
    }
  }

  /** Da abbinare: codice nuovo ogni 9 minuti, e ogni 3 secondi si guarda se qualcuno l'ha usato dalla PWA. */
  async #pair() {
    if (this.household) this.store.forget(); // era abbinato ed è stato scollegato
    const fresh = async () => {
      const { data, error } = await this.client.rpc("start_pairing");
      if (error) return console.warn("Codice non ottenuto:", error.message);
      this.pairing = { code: data as string, expiresAt: new Date(Date.now() + CODE_REFRESH_MS).toISOString() };
      console.log(`Da abbinare: codice ${this.pairing.code}`);
      this.events.changed();
    };
    await fresh();
    const renew = setInterval(fresh, CODE_REFRESH_MS);
    const poll = setInterval(async () => {
      const { data } = await this.client.from("devices").select("id").eq("user_id", this.#uid).maybeSingle();
      if (!data) return;
      clearInterval(renew);
      clearInterval(poll);
      await this.#identify();
    }, PAIR_POLL_MS);
  }

  /** Battito: la PWA vede che Roby è acceso. Se la riga del dispositivo non c'è più, è stato scollegato. */
  async #beat() {
    if (!this.household) return;
    try {
      const { error } = await this.client.rpc("device_heartbeat");
      if (error) throw error;
      const { data } = await this.client.from("devices").select("id").eq("user_id", this.#uid).maybeSingle();
      this.#setOnline(true);
      if (!data) {
        console.log("Scollegato dalla casa.");
        if (this.#channel) await this.client.removeChannel(this.#channel);
        this.#channel = undefined;
        await this.#pair();
      }
    } catch {
      this.#setOnline(false);
    }
  }

  #listen(hid: string) {
    if (this.#channel) void this.client.removeChannel(this.#channel);
    const channel = this.client.channel(`brain:${hid}`);
    for (const table of MIRRORED) {
      channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `household_id=eq.${hid}` }, (payload) => {
        const row = payload.new as Row & { embedding?: unknown; created_by?: string };
        if (!row?.id) return;
        delete row.embedding;
        this.store.receive(table, [row]);
        if (table === "shopping_items" && payload.eventType === "INSERT" && row.created_by !== this.#uid) this.events.arrived(String(row.name));
        this.events.changed();
      });
    }
    channel.subscribe((status) => status === "SUBSCRIBED" && void this.sync());
    this.#channel = channel;
  }

  /** Un giro alla volta: prima la coda in uscita, poi il download. Se arrivano modifiche durante un giro, se ne fa un altro. */
  sync(): Promise<void> {
    if (this.#syncing) {
      this.#again = true;
      return this.#syncing;
    }
    this.#syncing = (async () => {
      do {
        this.#again = false;
        await this.#round();
      } while (this.#again);
    })().finally(() => (this.#syncing = undefined));
    return this.#syncing;
  }

  async #round() {
    const house = this.household;
    if (!house) return;
    const report = await flush(this.store.queue(), (op) => this.#send(op));
    this.store.sent(report);
    for (const e of report.errors) console.warn(`Modifica rifiutata (${e.entry.op.table}): ${e.error}`);
    if (report.stopped) return this.#setOnline(false);
    try {
      for (const table of MIRRORED) await this.#pull(house.id, table);
      const stats = await this.client.from("shopping_item_stats").select("name_norm, name, category, uses").eq("household_id", house.id).order("uses", { ascending: false }).limit(200);
      if (!stats.error) this.store.set("stats", stats.data);
      this.#setOnline(true);
      this.events.changed();
    } catch {
      this.#setOnline(false);
    }
  }

  async #send(op: BrainOp): Promise<SendResult> {
    try {
      const table = this.client.from(op.table);
      const { error, status } = op.kind === "insert" ? await table.insert(op.row) : await table.update(op.patch).eq("id", op.itemId);
      return classify(error, status);
    } catch {
      return "retry";
    }
  }

  async #pull(hid: string, table: Mirrored) {
    const pulledAt = this.store.get<string>(`pulledAt:${table}`);
    const full = !pulledAt || Date.now() - Date.parse(pulledAt) > FULL_AFTER_MS;
    const since = full ? null : this.store.get<string>(`pull:${table}`);
    let query = this.client.from(table).select(COLUMNS[table]).eq("household_id", hid);
    // Download completo: solo le righe vive. Altrimenti tutto ciò che è cambiato, cancellazioni comprese.
    query = since ? query.gte("updated_at", since) : query.is("deleted_at", null);
    const { data, error } = await query;
    if (error) throw error;
    const rows = data as unknown as Row[];
    this.store.receive(table, rows);
    if (full) this.store.keepOnly(table, new Set(rows.map((r) => r.id)));
    const latest = rows.reduce<string | null>((max, r) => (!max || Date.parse(r.updated_at) > Date.parse(max) ? r.updated_at : max), since);
    this.store.set(`pull:${table}`, latest ?? new Date(0).toISOString());
    this.store.set(`pulledAt:${table}`, new Date().toISOString());
  }

  /**
   * La vetrina dei timer per la PWA: la tabella timers deve avere gli stessi timer del Pi.
   * Solo inserimenti, stato e cancellazioni (le colonne che il dispositivo può toccare).
   */
  async publishTimers(timers: HomeTimer[]) {
    const house = this.household;
    if (!house || !this.online) return;
    const known = this.store.get<Record<string, string>>("timers:remote") ?? {};
    const next: Record<string, string> = {};
    try {
      for (const t of timers) {
        const sig = `${t.status}|${t.endsAt}`;
        if (!(t.id in known)) {
          const { error } = await this.client.from("timers").insert({ id: t.id, household_id: house.id, label: t.label, duration_s: t.durationS, ends_at: t.endsAt, status: t.status });
          if (error && error.code !== "23505") throw error;
        } else if (known[t.id] !== sig) {
          const { error } = await this.client.from("timers").update({ status: t.status, ends_at: t.endsAt }).eq("id", t.id);
          if (error) throw error;
        }
        next[t.id] = sig;
      }
      const gone = Object.keys(known).filter((id) => !(id in next));
      if (gone.length) {
        const { error } = await this.client.from("timers").delete().in("id", gone);
        if (error) throw error;
      }
      this.store.set("timers:remote", next);
    } catch (e) {
      console.warn("Timer non pubblicati:", (e as Error).message);
    }
  }
}
