"use client";

import { useState } from "react";
import Link from "next/link";
import { Television } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import Button from "@/components/ui/Button";
import type { Household } from "./HouseholdGate";

// Accesa se ha dato segni di vita negli ultimi 3 minuti (la TV batte ogni minuto).
const seen = (at: string | null) => {
  if (!at) return "Mai accesa";
  const min = Math.round((Date.now() - Date.parse(at)) / 60_000);
  if (min <= 3) return "Accesa";
  if (min < 60) return `Vista ${min} minuti fa`;
  return `Vista ${new Date(at).toLocaleString("it-IT", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}`;
};

export default function Devices({ house }: { house: Household }) {
  // Dai dati della casa (che si aggiornano quando risponde il server), meno quelle appena scollegate.
  const [removed, setRemoved] = useState<string[]>([]);
  const devices = (house.devices ?? []).filter((d) => !removed.includes(d.id));

  async function unlink(id: string) {
    const { error } = await supabase.from("devices").delete().eq("id", id);
    if (!error) setRemoved((r) => [...r, id]);
  }

  return (
    <section aria-labelledby="tv" className="flex flex-col gap-3 border-t-4 border-ink pt-5">
      <h2 id="tv" className="text-xl font-semibold">Televisori</h2>
      {devices.length === 0 && <p className="text-muted">Nessuna TV abbinata.</p>}
      <ul>
        {devices.map((d) => (
          <li key={d.id} className="flex min-h-14 items-center justify-between gap-4 border-b border-line last:border-b-0">
            <span className="flex items-center gap-3">
              <Television aria-hidden weight="bold" className="size-6" />
              <span className="flex flex-col">
                <span className="text-xl font-medium">{d.name}</span>
                <span className="text-sm text-muted">{seen(d.last_seen_at)}</span>
              </span>
            </span>
            <Button variant="link" onClick={() => unlink(d.id)}>Scollega</Button>
          </li>
        ))}
      </ul>
      <Link href="/abbina" className="inline-flex min-h-12 items-center self-start rounded-control border border-edge bg-surface px-5 font-semibold active:translate-y-px">
        Abbina una TV
      </Link>
    </section>
  );
}
