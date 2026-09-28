"use client";

import { useState } from "react";
import { Plus } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import type { Tables } from "@/lib/database.types";
import { useRows } from "@/lib/useRows";
import Big from "@/components/dash/Big";
import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import Section from "@/components/ui/Section";

type Note = Tables<"notes">;

// Il second brain: le cose di casa da ritrovare ("la chiave di scorta è da mia madre", "filtro caldaia cambiato").
// Si aggiungono qui, a voce a Roby ("ricorda che…") o dalla schermata Oggi. Le domande libere le fa Roby.
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const COLUMNS = "id, household_id, body, source, created_at, updated_at, deleted_at";
const SOURCE: Record<string, string> = { voce: "detta a Roby", pwa: "scritta qui", share: "condivisa" };

export default function Notes({ householdId }: { householdId: string }) {
  const { rows, error, setError, reload } = useRows<Note>("notes", householdId, COLUMNS);
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Note | null>(null);
  const [busy, setBusy] = useState(false);

  // Ricerca sul dispositivo, anche offline: tutte le parole cercate devono comparire.
  const words = fold(query).split(/\s+/).filter(Boolean);
  const notes = (rows ?? [])
    .filter((n) => words.every((w) => fold(n.body).includes(w)))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("notes").insert({ household_id: householdId, body: text.trim(), source: "pwa" });
    setBusy(false);
    if (error) return setError(error.message);
    setText("");
    void reload();
  }

  return (
    <Section aside={<>
      <PageHeader title="Note">
        <p className="flex items-end gap-3">
          <Big className="text-8xl lg:text-[10rem]">{rows ? String(rows.length).padStart(2, "0") : "--"}</Big>
          <span className="pb-2 text-xl text-muted">{rows?.length === 1 ? "cosa da ricordare" : "cose da ricordare"}</span>
        </p>
      </PageHeader>

      <form onSubmit={save} className="flex flex-col gap-3">
        <label htmlFor="note" className="font-semibold">Nuova nota</label>
        <textarea
          id="note" value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={4000}
          placeholder="Il codice del cancello è 4512"
          className="rounded-control border border-edge bg-surface px-4 py-3 text-lg"
        />
        <Button type="submit" disabled={!text.trim() || busy} className="self-start">
          <Plus aria-hidden weight="bold" className="size-5" /> Salva
        </Button>
      </form>
      {error && <p role="alert" className="text-danger">Operazione non riuscita (serve la rete): {error}</p>}
    </>}>

      <div className="flex flex-col gap-2">
        <label htmlFor="search" className="sr-only">Cerca nelle note</label>
        <input
          id="search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cerca: chiave, caldaia, codice…"
          className="min-h-12 rounded-control border border-edge bg-surface px-4 text-lg"
        />
      </div>

      {rows && rows.length === 0 && (
        <EmptyState expression="thinking" title="Nessuna nota">
          Scrivi qui quello che non vuoi dimenticare, oppure dillo a Roby: &ldquo;ricorda che il codice del cancello è 4512&rdquo;.
          Poi chiedi &ldquo;qual è il codice del cancello?&rdquo;.
        </EmptyState>
      )}
      {rows && rows.length > 0 && notes.length === 0 && <p className="text-xl text-muted">Nessuna nota con &ldquo;{query}&rdquo;.</p>}

      <ul>
        {notes.map((n) => (
          <li key={n.id} className="border-b border-line last:border-b-0">
            <button type="button" onClick={() => setEditing(n)} className="flex w-full flex-col gap-1 py-4 text-left">
              <span className="text-xl leading-snug font-medium">{n.body}</span>
              <span className="text-sm text-muted">
                {new Date(n.created_at).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}, {SOURCE[n.source] ?? n.source}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title="Nota">
        {editing && <NoteForm key={editing.id} note={editing} onDone={() => { setEditing(null); void reload(); }} />}
      </Dialog>
    </Section>
  );
}

function NoteForm({ note, onDone }: { note: Note; onDone: () => void }) {
  const [body, setBody] = useState(note.body);
  const [error, setError] = useState("");

  async function run(patch: Partial<Pick<Note, "body" | "deleted_at">>) {
    const { error } = await supabase.from("notes").update(patch).eq("id", note.id);
    if (error) setError(error.message);
    else onDone();
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); void run({ body: body.trim() }); }} className="flex flex-col gap-4">
      <label htmlFor="note-body" className="sr-only">Testo</label>
      <textarea id="note-body" value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={4000}
        className="rounded-control border border-edge bg-surface px-4 py-3 text-lg" />
      {error && <p role="alert" className="text-danger">Non riuscito: {error}</p>}
      <div className="flex items-center justify-between gap-3">
        <Button variant="link" type="button" onClick={() => run({ deleted_at: new Date().toISOString() })} className="text-danger">Elimina</Button>
        <Button type="submit" disabled={!body.trim() || body.trim() === note.body}>Salva</Button>
      </div>
    </form>
  );
}
