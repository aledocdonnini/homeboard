"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Microphone } from "@phosphor-icons/react";
import Button from "@/components/ui/Button";
import type { useAssistant } from "./useAssistant";
import { useDictation } from "./useDictation";

// Il campo unico: si scrive come si parlerebbe a Roby ("latte e uova", "ricordami domani alle 9 di…").
// `replyHere`: sul telefono la risposta sta sotto il campo; su desktop la dice Roby nel suo riquadro.
export default function Ask({ assistant, replyHere = true }: { assistant: ReturnType<typeof useAssistant>; replyHere?: boolean }) {
  const [text, setText] = useState("");
  const id = useId();
  const { reply, busy, ask } = assistant;
  const router = useRouter();
  // Sul telefono "mostrami la spesa" apre la sezione; sul computer (replyHere false) cambia il pannello al centro.
  useEffect(() => {
    if (replyHere && reply?.go && reply.href) router.push(reply.href);
  }, [reply, replyHere, router]);
  const voice = useDictation({ onPartial: setText, onFinal: (said) => { setText(""); void ask(said); } });

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
        {voice.supported && (
          <Button type="button" variant="quiet" onClick={voice.listening ? voice.stop : voice.start} aria-pressed={voice.listening}
            aria-label={voice.listening ? "Smetti di ascoltare" : "Premi e parla"}
            className="px-4 aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-on-accent">
            <Microphone aria-hidden weight={voice.listening ? "fill" : "bold"} className="size-5" />
          </Button>
        )}
        <Button type="submit" disabled={!text.trim() || busy} aria-label="Invia" className="px-4">
          <ArrowRight aria-hidden weight="bold" className="size-5" />
        </Button>
      </div>
      {voice.listening && <p role="status" className="text-muted">Ti ascolto…</p>}
      {voice.error && <p role="alert" className="text-muted">{voice.error}</p>}
      {replyHere && reply && (
        <p role="status" className={`text-lg leading-snug ${reply.tone === "error" ? "text-muted" : ""}`}>
          {reply.text}
          {reply.href && <> <Link href={reply.href} className="font-semibold underline underline-offset-4">Apri</Link></>}
        </p>
      )}
    </form>
  );
}
