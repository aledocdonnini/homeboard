"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import Button from "@/components/ui/Button";
import type { useAssistant } from "./useAssistant";

// Il campo unico: si scrive come si parlerebbe a Roby ("latte e uova", "ricordami domani alle 9 di…").
// `replyHere`: sul telefono la risposta sta sotto il campo; su desktop la dice Roby nel suo riquadro.
export default function Ask({ assistant, replyHere = true }: { assistant: ReturnType<typeof useAssistant>; replyHere?: boolean }) {
  const [text, setText] = useState("");
  const id = useId();
  const { reply, busy, ask } = assistant;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const said = text;
    setText("");
    await ask(said);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label htmlFor={id} className="text-sm font-medium text-muted">Chiedi a Roby</label>
      <div className="flex gap-2">
        <input
          id={id} value={text} onChange={(e) => setText(e.target.value)} enterKeyHint="send" autoComplete="off"
          placeholder="Latte e uova, ricordami domani alle 9 di…"
          className="min-h-12 min-w-0 flex-1 rounded-control border border-edge bg-surface px-4 text-lg"
        />
        <Button type="submit" disabled={!text.trim() || busy} aria-label="Invia" className="px-4">
          <ArrowRight aria-hidden weight="bold" className="size-5" />
        </Button>
      </div>
      {replyHere && reply && (
        <p role="status" className={`text-lg leading-snug ${reply.tone === "error" ? "text-muted" : ""}`}>
          {reply.text}
          {reply.href && <> <Link href={reply.href} className="font-semibold underline underline-offset-4">Apri</Link></>}
        </p>
      )}
    </form>
  );
}
