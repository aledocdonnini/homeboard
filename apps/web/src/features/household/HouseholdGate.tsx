"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/features/auth/useSession";
import CreateHousehold from "./CreateHousehold";

const query = () => supabase.from("households").select("id, name, household_members(user_id, role, display_name)").order("created_at");
export type Household = NonNullable<Awaited<ReturnType<typeof query>>["data"]>[number];

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
    query().then(({ data, error }) => (error ? setError(error.message) : setHouseholds(data)));
  }, [session, router, version]);

  if (error) return <p role="alert" className="p-6">{error}</p>;
  if (!session || !households) return null;
  // ponytail: una casa sola in interfaccia (la prima); lo schema ne permette più di una, aggiungi un selettore se servirà.
  const house = households[0];
  if (!house) return <CreateHousehold onCreated={() => setVersion((v) => v + 1)} />;
  return children(house, session);
}
