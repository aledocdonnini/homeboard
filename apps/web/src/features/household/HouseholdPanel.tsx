"use client";

import { SignOut } from "@phosphor-icons/react";
import { signOut } from "@/features/auth/signOut";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import Button from "@/components/ui/Button";
import Big from "@/components/dash/Big";
import PageHeader from "@/components/ui/PageHeader";
import type { Household } from "./HouseholdGate";
import AddMember from "./AddMember";
import PushSettings from "./PushSettings";
import Devices from "./Devices";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function HouseholdPanel({ house, session }: { house: Household; session: Session }) {
  const isOwner = house.household_members.some((m) => m.user_id === session.user.id && m.role === "owner");

  async function remove(userId: string) {
    const { error } = await supabase.from("household_members").delete().eq("household_id", house.id).eq("user_id", userId);
    if (!error) location.reload();
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 pt-6 pb-32 lg:max-w-2xl">
      <PageHeader title="Casa">
        <p className="flex items-end gap-3">
          <Big className="text-8xl">{String(house.household_members.length).padStart(2, "0")}</Big>
          <span className="pb-2 text-xl text-muted">{house.household_members.length === 1 ? "persona" : "persone"} in {house.name}</span>
        </p>
      </PageHeader>

      <section aria-labelledby="members" className="flex flex-col gap-3">
        <h2 id="members" className="text-xl font-semibold">Chi abita qui</h2>
        <ul className="flex flex-col">
          {house.household_members.map((m) => (
            <li key={m.user_id} className="flex min-h-14 items-center justify-between gap-4 border-b border-line last:border-b-0">
              <span className="text-xl font-medium">
                {capitalize(m.display_name ?? "Membro")}
                {m.user_id === session.user.id && <span className="text-muted"> (tu)</span>}
              </span>
              {m.role === "owner"
                ? <span className="text-sm text-muted">Ha creato la casa</span>
                : isOwner && <Button variant="link" onClick={() => remove(m.user_id)}>Togli</Button>}
            </li>
          ))}
        </ul>
        {isOwner && <AddMember householdId={house.id} onAdded={() => location.reload()} />}
      </section>

      <Devices house={house} />

      <PushSettings />

      <section aria-labelledby="account" className="flex flex-col gap-3 border-t-4 border-ink pt-5">
        <h2 id="account" className="text-xl font-semibold">Il tuo account</h2>
        <p className="text-muted">{session.user.email}</p>
        <Button variant="quiet" onClick={signOut} className="self-start">
          <SignOut aria-hidden weight="bold" className="size-5" /> Esci
        </Button>
      </section>
    </main>
  );
}
