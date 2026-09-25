"use client";

import { CloudSlash, ArrowsClockwise } from "@phosphor-icons/react";
import { useOnline } from "@/lib/useOnline";

// Dice solo quando c'è qualcosa da sapere: offline, o modifiche non ancora arrivate agli altri.
export default function SyncStatus({ pending }: { pending: number }) {
  const online = useOnline();
  if (online && pending === 0) return null;
  const waiting = pending === 1 ? "1 modifica in attesa" : `${pending} modifiche in attesa`;
  return (
    <p role="status" className="flex items-center gap-2 text-muted">
      {online ? <ArrowsClockwise aria-hidden className="size-5 motion-safe:animate-spin" /> : <CloudSlash aria-hidden className="size-5" />}
      {online ? `Invio in corso, ${waiting}` : pending ? `Sei offline: ${waiting}, partono quando torna la rete.` : "Sei offline: puoi usare la lista, le modifiche partono quando torna la rete."}
    </p>
  );
}
