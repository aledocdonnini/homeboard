"use client";

import { SignOut } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import type { Household } from "./HouseholdGate";
import InviteButton from "./InviteButton";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function HouseholdPanel({ house, session }: { house: Household; session: Session }) {
  return (
    <main data-channel="casa" className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 pt-4 pb-32">
      <PageHeader title={house.name} />

      <section aria-labelledby="members" className="flex flex-col gap-3">
        <h2 id="members" className="text-xl font-semibold">Chi abita qui</h2>
        <ul className="flex flex-col">
          {house.household_members.map((m) => (
            <li key={m.user_id} className="flex min-h-12 items-center justify-between gap-4 border-b border-line last:border-b-0">
              <span className="text-lg">
                {capitalize(m.display_name ?? "Membro")}
                {m.user_id === session.user.id && <span className="text-muted"> (tu)</span>}
              </span>
              {m.role === "owner" && <span className="text-sm text-muted">Ha creato la casa</span>}
            </li>
          ))}
        </ul>
        <InviteButton householdId={house.id} householdName={house.name} />
      </section>

      <section aria-labelledby="account" className="flex flex-col gap-3 border-t border-line pt-6">
        <h2 id="account" className="text-xl font-semibold">Il tuo account</h2>
        <p className="text-muted">{session.user.email}</p>
        <Button variant="quiet" onClick={() => supabase.auth.signOut()} className="self-start">
          <SignOut aria-hidden weight="bold" className="size-5" /> Esci
        </Button>
      </section>
    </main>
  );
}
