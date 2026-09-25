"use client";

import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import type { Household } from "./HouseholdGate";
import InviteButton from "./InviteButton";

export default function HouseholdPanel({ house, session }: { house: Household; session: Session }) {
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
