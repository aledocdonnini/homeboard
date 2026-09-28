"use client";

import { useCallback, useEffect, useState } from "react";
import { renderSVG } from "uqr";
import { tvClient } from "@/lib/supabase";
import Big from "@/components/dash/Big";
import RobyTile from "@/components/ui/RobyTile";
import type { Deadline } from "@/features/deadlines/due";
import { toDashData } from "@/features/home/dashData";
import type { Reminder } from "@/features/reminders/schedule";
import type { Item } from "@homeboard/core/items";
import TvScreen, { type Arrival } from "./TvScreen";

// La TV: nessun login interattivo. Entra come utente anonimo (la sessione resta in questo browser),
// mostra un codice da abbinare dalla PWA, poi legge i dati della casa in sola lettura.
// Il codice dura 10 minuti: se nessuno lo usa se ne chiede un altro.
const CODE_REFRESH_MS = 9 * 60_000;
const BEAT_MS = 60_000;

type House = { id: string; timezone: string; night_start: string; night_end: string };
type Rows = { items: Item[]; reminders: Reminder[]; deadlines: Deadline[] };
const CACHE = "hb:tv:rows";

export default function TvApp() {
  const db = tvClient();
  const [house, setHouse] = useState<House | null | undefined>(undefined); // null = da abbinare
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  // Chi sono e di che casa sono. Senza sessione: una anonima nuova.
  const whoAmI = useCallback(async () => {
    let { data: { session } } = await db.auth.getSession();
    if (!session) {
      const { data, error } = await db.auth.signInAnonymously();
      if (error) return setError(`Accesso non riuscito: ${error.message}`);
      session = data.session;
    }
    const { data, error } = await db.from("devices").select("households(id, timezone, night_start, night_end)")
      .eq("user_id", session!.user.id).maybeSingle();
    if (error) return setError(`Non riesco a raggiungere il server: ${error.message}`);
    setError("");
    setHouse((data?.households as House | null) ?? null);
  }, [db]);

  useEffect(() => { Promise.resolve().then(whoAmI); }, [whoAmI]);

  // Da abbinare: codice nuovo ogni 9 minuti, e ogni 3 secondi si controlla se qualcuno l'ha usato.
  useEffect(() => {
    if (house !== null) return;
    const fresh = () => db.rpc("start_pairing").then(({ data, error }) => (error ? setError(error.message) : setCode(data)));
    void fresh();
    const renew = setInterval(fresh, CODE_REFRESH_MS);
    const check = setInterval(whoAmI, 3000);
    return () => {
      clearInterval(renew);
      clearInterval(check);
    };
  }, [house, db, whoAmI]);

  if (error && house === undefined) return <Message title="Nessun segnale" body={error} />;
  if (house === undefined) return null;
  if (house === null) return <Pairing code={code} />;
  return <OnAir house={house} onRevoked={() => setHouse(null)} />;
}

function OnAir({ house, onRevoked }: { house: House; onRevoked: () => void }) {
  const db = tvClient();
  const [rows, setRows] = useState<Rows>(() => {
    try { return JSON.parse(localStorage.getItem(CACHE) ?? "null") ?? { items: [], reminders: [], deadlines: [] }; }
    catch { return { items: [], reminders: [], deadlines: [] }; }
  });
  const [arrival, setArrival] = useState<Arrival | null>(null);
  const [now, setNow] = useState(() => new Date());
  const voiceUrl = typeof location !== "undefined" ? new URLSearchParams(location.search).get("voce") : null;

  const load = useCallback(async () => {
    const hid = house.id;
    const [items, reminders, deadlines] = await Promise.all([
      db.from("shopping_items").select("id, household_id, name, category, checked, position, updated_at, deleted_at").eq("household_id", hid).is("deleted_at", null),
      db.from("reminders").select("*").eq("household_id", hid).is("deleted_at", null),
      db.from("deadlines").select("*").eq("household_id", hid).is("deleted_at", null).is("done_at", null),
    ]);
    if (items.error || reminders.error || deadlines.error) return; // offline: resta l'ultima copia
    const next = { items: items.data, reminders: reminders.data, deadlines: deadlines.data };
    setRows(next);
    setNow(new Date());
    try { localStorage.setItem(CACHE, JSON.stringify(next)); } catch {}
  }, [db, house.id]);

  useEffect(() => {
    // Realtime: a ogni cambiamento si rilegge tutto (sono poche righe); i nuovi arrivi Roby li annuncia.
    const channel = db.channel(`tv:${house.id}`);
    for (const table of ["shopping_items", "reminders", "deadlines"] as const) {
      channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `household_id=eq.${house.id}` }, (payload) => {
        void load();
        if (payload.eventType !== "INSERT") return;
        const row = payload.new as { name?: string; title?: string };
        const text = table === "shopping_items" ? `In lista: ${row.name}` : table === "reminders" ? `Nuovo promemoria: ${row.title}` : `Nuova scadenza: ${row.title}`;
        setArrival({ text, at: Date.now() });
      });
    }
    channel.subscribe((status) => status === "SUBSCRIBED" && load());
    // Battito ogni minuto: la PWA vede se la TV è accesa. Se la riga del dispositivo non c'è più, è stata scollegata.
    const beat = setInterval(async () => {
      setNow(new Date());
      await db.rpc("device_heartbeat");
      const { data, error } = await db.from("devices").select("id").maybeSingle();
      if (!error && !data) onRevoked();
    }, BEAT_MS);
    addEventListener("online", load);
    return () => {
      clearInterval(beat);
      removeEventListener("online", load);
      db.removeChannel(channel);
    };
  }, [db, house.id, load, onRevoked]);

  return (
    <TvScreen
      data={toDashData(rows.items, rows.reminders, rows.deadlines, house.timezone, now)}
      tz={house.timezone}
      night={{ start: house.night_start.slice(0, 5), end: house.night_end.slice(0, 5) }}
      arrival={arrival}
      voiceUrl={voiceUrl}
    />
  );
}

function Pairing({ code }: { code: string }) {
  const url = typeof location !== "undefined" ? `${location.origin}/abbina?codice=${code}` : "";
  return (
    <main className="crt grid h-[100dvh] grid-cols-12 items-center gap-10 p-[calc(3rem+var(--overscan))]">
      <div className="col-span-7 flex flex-col gap-8">
        <RobyTile expression="listening" className="size-32" />
        <h1 className="text-6xl font-semibold tracking-tight">Abbina questa TV alla tua casa</h1>
        <p className="text-3xl leading-snug text-muted">
          Inquadra il codice con il telefono, oppure apri Homeboard, vai su Casa e scegli &laquo;Abbina una TV&raquo;.
        </p>
        <p aria-label={`Codice ${code.split("").join(" ")}`}>
          <Big className="text-[9rem] tracking-[0.08em]">{code || "······"}</Big>
        </p>
      </div>
      {code && (
        <div aria-hidden className="col-span-5 rounded-module bg-[#f4f3f0] p-8"
          dangerouslySetInnerHTML={{ __html: renderSVG(url, { border: 1, whiteColor: "#f4f3f0", blackColor: "#141414" }) }} />
      )}
    </main>
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <main className="crt flex h-[100dvh] flex-col justify-center gap-6 p-[calc(3rem+var(--overscan))]">
      <RobyTile expression="confused" className="size-32" />
      <h1 className="text-6xl font-semibold">{title}</h1>
      <p className="text-3xl text-muted">{body}</p>
    </main>
  );
}
