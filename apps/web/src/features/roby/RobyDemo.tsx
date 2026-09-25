"use client";

import { useEffect, useRef, useState } from "react";
import { EXPRESSIONS, type ExpressionId, type Mode } from "roby-face/engine";
import type { RobyFaceElement } from "roby-face";

const MODES: { id: Mode; label: string }[] = [
  { id: "idle", label: "Fermo" },
  { id: "talking", label: "Parla" },
  { id: "listening", label: "Ascolta" },
];

export default function RobyDemo() {
  const face = useRef<RobyFaceElement>(null);
  const [expression, setExpression] = useState<ExpressionId>("neutral");
  const [mode, setMode] = useState<Mode>("idle");
  const [text, setText] = useState("Ciao, sono Roby. Domani scade il bollo dell'auto.");
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    import("roby-face"); // registra <roby-face> solo nel browser
    const el = face.current!;
    const onEvent = (e: Event) => {
      const { detail } = e as CustomEvent<Record<string, unknown>>;
      setLog((l) => [`${e.type} ${JSON.stringify(detail)}`, ...l].slice(0, 8));
    };
    const types = ["roby-expression", "roby-speechstart", "roby-speechend"];
    types.forEach((t) => el.addEventListener(t, onEvent));
    return () => types.forEach((t) => el.removeEventListener(t, onEvent));
  }, []);

  return (
    <main className="mx-auto grid w-full max-w-5xl gap-8 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:p-8">
      <roby-face ref={face} expression={expression} mode={mode} className="w-full rounded-3xl overflow-hidden" />

      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold">&lt;roby-face&gt;</h1>

        <fieldset className="flex flex-wrap gap-2">
          <legend className="mb-2 text-sm opacity-70">Espressione</legend>
          {EXPRESSIONS.map((e) => (
            <button
              key={e.id}
              type="button"
              aria-pressed={e.id === expression}
              onClick={() => setExpression(e.id)}
              className="rounded-full border px-3 py-1 text-sm aria-pressed:bg-foreground aria-pressed:text-background"
            >
              {e.label}
            </button>
          ))}
        </fieldset>

        <fieldset className="flex gap-2">
          <legend className="mb-2 text-sm opacity-70">Modalità</legend>
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={m.id === mode}
              onClick={() => setMode(m.id)}
              className="rounded-full border px-3 py-1 text-sm aria-pressed:bg-foreground aria-pressed:text-background"
            >
              {m.label}
            </button>
          ))}
        </fieldset>

        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            face.current?.speak(text).catch((err: Error) => setLog((l) => [`errore: ${err.message}`, ...l]));
          }}
        >
          <label htmlFor="say" className="text-sm opacity-70">Testo da dire</label>
          <textarea id="say" value={text} onChange={(e) => setText(e.target.value)} rows={3} className="rounded-lg border bg-transparent p-2" />
          <div className="flex gap-2">
            <button type="submit" className="rounded-full bg-foreground px-4 py-2 text-background">Parla</button>
            <button type="button" onClick={() => face.current?.stop()} className="rounded-full border px-4 py-2">Stop</button>
          </div>
        </form>

        <section aria-live="polite">
          <h2 className="mb-2 text-sm opacity-70">Eventi</h2>
          <ul className="font-mono text-xs leading-relaxed break-all">
            {log.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        </section>
      </div>
    </main>
  );
}
