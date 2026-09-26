"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/features/auth/useSession";
import NoHousehold from "./NoHousehold";

const query = () => supabase.from("households").select("id, name, timezone, household_members(user_id, role, display_name), devices(id, name, last_seen_at)").order("created_at");
export type Household = NonNullable<Awaited<ReturnType<typeof query>>["data"]>[number];
// La copia salvata da una versione precedente può non avere il fuso: la casa di default è in Italia.
export const timezoneOf = (h: Household) => h.timezone ?? "Europe/Rome";

/** Mostra i figli solo con un membro connesso e una casa; altrimenti manda al login o alla creazione della casa. */
export default function HouseholdGate({ children }: { children: (house: Household, session: Session) => ReactNode }) {
  const router = useRouter();
  const session = useSession();
  const [households, setHouseholds] = useState<Household[]>();
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0); // +1 = ricarica

  useEffect(() => {
    if (session === null) router.replace(`/accedi?next=${encodeURIComponent(location.pathname)}`);
    if (!session) return;
    // Prima la casa salvata sul dispositivo (si apre subito, anche offline o con la rete a singhiozzo),
    // poi quella del server quando risponde.
    const key = `hb:households:${session.user.id}`;
    let cached: Household[] | null = null;
    try { cached = JSON.parse(localStorage.getItem(key) ?? "null"); } catch {}
    Promise.resolve().then(() => cached && setHouseholds(cached));
    query().then(({ data, error }) => {
      if (!error) {
        setHouseholds(data);
        try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
      } else if (!cached) {
        setError("Non riesco a raggiungere il server. Controlla la connessione e riprova.");
      }
    });
  }, [session, router, version]);

  if (error) return <p role="alert" className="p-6">{error}</p>;
  if (!session || !households) return null;
  // ponytail: una casa sola in interfaccia (la prima); lo schema ne permette più di una, aggiungi un selettore se servirà.
  const house = households[0];
  if (!house) return <NoHousehold email={session.user.email ?? ""} onCreated={() => setVersion((v) => v + 1)} />;
  return children(house, session);
}
