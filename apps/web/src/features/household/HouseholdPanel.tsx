"use client";

import Link from "next/link";
import { ArrowLeft, SignOut } from "@phosphor-icons/react";
import { signOut } from "@/features/auth/signOut";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import Button from "@/components/ui/Button";
import Big from "@/components/dash/Big";
import PageHeader from "@/components/ui/PageHeader";
import Section from "@/components/ui/Section";
import type { Household } from "./HouseholdGate";
import AddMember from "./AddMember";
import PushSettings from "./PushSettings";
import Devices from "./Devices";
import PasswordSettings from "./PasswordSettings";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function HouseholdPanel({ house, session }: { house: Household; session: Session }) {
  const isOwner = house.household_members.some((m) => m.user_id === session.user.id && m.role === "owner");

  async function remove(userId: string) {
    const { error } = await supabase.from("household_members").delete().eq("household_id", house.id).eq("user_id", userId);
    if (!error) location.reload();
  }

  return (
    <Section aside={<>
      {/* Sul computer non c'è la barra delle sezioni: si torna alla postazione da qui. */}
      <Link href="/" className="hidden items-center gap-2 self-start text-lg font-semibold underline-offset-4 hover:underline lg:flex">
        <ArrowLeft aria-hidden weight="bold" className="size-5" /> Torna a Roby
      </Link>
      <PageHeader title="Casa">
        <p className="flex items-end gap-3">
          <Big className="text-8xl lg:text-[10rem]">{String(house.household_members.length).padStart(2, "0")}</Big>
          <span className="pb-2 text-xl text-muted">{house.household_members.length === 1 ? "persona" : "persone"} in {house.name}</span>
        </p>
      </PageHeader>
      <section aria-labelledby="account" className="hidden flex-col gap-3 lg:flex lg:pt-6">
        <h2 id="account" className="text-xl font-semibold">Il tuo account</h2>
        <p className="text-muted">{session.user.email}</p>
        <Button variant="quiet" onClick={signOut} className="self-start">
          <SignOut aria-hidden weight="bold" className="size-5" /> Esci
        </Button>
      </section>
      </>}>
      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-14 lg:gap-y-10">

      <section aria-labelledby="members" className="flex flex-col gap-3 lg:border-t-4 lg:border-ink lg:pt-5">
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

      <PasswordSettings />

        {/* Sul telefono l'account va in fondo; su desktop sta nella colonna a sinistra. */}
        <section aria-labelledby="account-m" className="flex flex-col gap-3 border-t-4 border-ink pt-5 lg:hidden">
        <h2 id="account-m" className="text-xl font-semibold">Il tuo account</h2>
        <p className="text-muted">{session.user.email}</p>
        <Button variant="quiet" onClick={signOut} className="self-start">
          <SignOut aria-hidden weight="bold" className="size-5" /> Esci
        </Button>
        </section>
      </div>
    </Section>
  );
}
