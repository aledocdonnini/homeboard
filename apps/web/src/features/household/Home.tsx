"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/features/auth/useSession";
import CreateHousehold from "./CreateHousehold";
import InviteButton from "./InviteButton";

const query = () => supabase.from("households").select("id, name, household_members(user_id, role, display_name)").order("created_at");
type Household = NonNullable<Awaited<ReturnType<typeof query>>["data"]>[number];

export default function Home() {
  const router = useRouter();
  const session = useSession();
  const [households, setHouseholds] = useState<Household[]>();
  const [error, setError] = useState("");

  const [version, setVersion] = useState(0); // +1 = ricarica

  useEffect(() => {
    if (session === null) router.replace("/accedi");
    if (!session) return;
    query().then(({ data, error }) => (error ? setError(error.message) : setHouseholds(data)));
  }, [session, router, version]);

  if (error) return <p role="alert" className="p-6">{error}</p>;
  if (!session || !households) return null;
  // ponytail: una casa sola in interfaccia (la prima); lo schema ne permette più di una, aggiungi un selettore se servirà.
  const house = households[0];
  if (!house) return <CreateHousehold onCreated={() => setVersion((v) => v + 1)} />;

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-8 p-6">
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="text-3xl font-semibold">{house.name}</h1>
        <button type="button" onClick={() => supabase.auth.signOut()} className="text-sm underline">Esci</button>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Chi abita qui</h2>
        <ul className="flex flex-col gap-1">
          {house.household_members.map((m) => (
            <li key={m.user_id}>
              {m.display_name ?? "Membro"}
              {m.user_id === session.user.id && " (tu)"}
              {m.role === "owner" && <span className="opacity-60"> · proprietario</span>}
            </li>
          ))}
        </ul>
        <InviteButton householdId={house.id} householdName={house.name} />
      </section>
    </main>
  );
}
