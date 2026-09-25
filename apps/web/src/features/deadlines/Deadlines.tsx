"use client";

import { useState } from "react";
import { Check, Plus } from "@phosphor-icons/react";
import { describe, zonedDate } from "@shared/recurrence";
import { supabase } from "@/lib/supabase";
import { useRows } from "@/lib/useRows";
import Big from "@/components/dash/Big";
import TickRuler from "@/components/dash/TickRuler";
import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import DeadlineForm from "./DeadlineForm";
import { categoryLabel, daysWord, nextDue, open, recurrenceOf, shortDate, whenLabel, type Deadline } from "./due";

const two = (n: number) => String(Math.abs(n)).padStart(2, "0");

export default function Deadlines({ householdId, tz }: { householdId: string; tz: string }) {
  const { rows, error, setError, reload } = useRows<Deadline>("deadlines", householdId);
  const [editing, setEditing] = useState<Deadline | "new" | null>(null);
  const [today] = useState(() => zonedDate(new Date(), tz));
  const todo = open(rows ?? [], today);
  const done = (rows ?? []).filter((d) => d.done_at).sort((a, b) => b.done_at!.localeCompare(a.done_at!)).slice(0, 5);
  const first = todo[0];

  async function complete(d: Deadline) {
    const next = nextDue(d);
    const { error } = await supabase.rpc("complete_deadline", { deadline: d.id, next_due: next ?? undefined });
    if (error) setError(error.message);
    else void reload();
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 pt-6 pb-32 lg:max-w-2xl">
      <PageHeader title="Scadenze">
        <p className="flex items-end gap-3">
          <Big className={`text-8xl ${first && first.daysLeft <= 7 ? "text-accent-text" : ""}`}>{first ? two(first.daysLeft) : "--"}</Big>
          <span className="pb-2 text-xl text-muted">{first ? daysWord(first.daysLeft) : "niente in scadenza"}</span>
        </p>
        {first && <p className="text-2xl font-semibold">{first.deadline.title}</p>}
        {first && first.daysLeft >= 0 && <TickRuler daysLeft={first.daysLeft} className="h-8" />}
      </PageHeader>

      <Button onClick={() => setEditing("new")} className="self-start">
        <Plus aria-hidden weight="bold" className="size-5" /> Nuova scadenza
      </Button>
      {error && <p role="alert" className="text-danger">Operazione non riuscita: {error}</p>}

      {rows && todo.length === 0 && (
        <EmptyState expression="serene" title="Nessuna scadenza">
          Aggiungi bollette, bollo, revisione, assicurazioni: ti avviso in anticipo, quanto vuoi tu.
        </EmptyState>
      )}

      {todo.length > 0 && (
        <ul>
          {todo.map(({ deadline: d, daysLeft }) => (
            <li key={d.id} className="flex items-start gap-4 border-b border-line py-4 last:border-b-0">
              <span aria-hidden className={`min-w-[2.2ch] shrink-0 text-6xl leading-[0.82] font-semibold tracking-[-0.05em] ${daysLeft <= 7 ? "text-accent-text" : ""}`}>
                {two(daysLeft)}
              </span>
              <button type="button" onClick={() => setEditing(d)} className="flex min-w-0 flex-1 flex-col text-left">
                <span className="text-xl font-medium">{d.title}</span>
                <span className="text-muted">
                  {whenLabel(daysLeft)}, {shortDate(d.due_date, today)}
                </span>
                <span className="text-sm text-muted">{categoryLabel(d.category)}. {describe(recurrenceOf(d))}</span>
              </button>
              <Button variant="quiet" onClick={() => complete(d)} aria-label={`Segna fatta: ${d.title}`} className="px-3">
                <Check aria-hidden weight="bold" className="size-5" /> Fatta
              </Button>
            </li>
          ))}
        </ul>
      )}

      {done.length > 0 && (
        <section aria-labelledby="done" className="flex flex-col border-t-4 border-ink pt-4">
          <h2 id="done" className="text-base font-semibold text-muted">Fatte di recente</h2>
          <ul>
            {done.map((d) => (
              <li key={d.id} className="border-b border-line py-3 text-lg text-muted last:border-b-0">
                {d.title}, fatta il {new Date(d.done_at!).toLocaleDateString("it-IT", { day: "numeric", month: "long" })}
              </li>
            ))}
          </ul>
        </section>
      )}

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Nuova scadenza" : "Scadenza"}>
        {editing !== null && (
          <DeadlineForm key={editing === "new" ? "new" : editing.id} householdId={householdId} today={today}
            deadline={editing === "new" ? undefined : editing} onDone={() => { setEditing(null); void reload(); }} />
        )}
      </Dialog>
    </main>
  );
}
