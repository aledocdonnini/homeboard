"use client";

import { useEffect, useState, type ReactNode, type Ref } from "react";
import type { RobyFaceElement } from "roby-face";
import type { HomeState } from "@homeboard/core/protocol";
import { faceFor, panelKey, pickPanel, type Panel } from "@homeboard/core/station";
import Monoscope from "./Monoscope";
import PanelView from "./Panels";
import Snow from "./Snow";

/**
 * La postazione: un solo layout, uguale sulla TV (/casa, dati da brain) e sul computer (la PWA, dati suoi).
 * A sinistra ora, Roby e la parte bassa (`footer`: sulla TV lo stato del microfono, sul computer il campo per
 * chiedere); a destra il pannello che sceglie pickPanel. Niente bottoni: la vista cambia a comando.
 * `sticky` (computer): la vista chiesta resta finché non se ne chiede un'altra.
 */
export default function Station({ state, face, footer, sticky = false }: {
  state: HomeState;
  face?: Ref<RobyFaceElement>;
  footer: (panel: Panel) => ReactNode;
  sticky?: boolean;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    import("roby-face");
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  const panel = pickPanel(state, now, { sticky });
  const key = panelKey(panel);
  // La neve parte quando cambia cosa mostra il pannello (stato aggiustato durante il render, non in un effetto).
  const [shown, setShown] = useState(key);
  const [snow, setSnow] = useState(0);
  if (key !== shown) {
    setShown(key);
    setSnow(snow + 1);
  }
  const { expression, mode } = faceFor(state, panel, now);

  if (panel.kind === "night") {
    return (
      <div className="crt relative h-[100dvh] overflow-hidden bg-black">
        <Monoscope night resume={state.household?.nightEnd} />
        <div className="fixed right-[calc(2.5rem+var(--overscan))] bottom-[calc(2.5rem+var(--overscan))]">{footer(panel)}</div>
      </div>
    );
  }

  return (
    <div className="crt h-[100dvh] overflow-hidden">
      <main className="grid h-full grid-cols-12 gap-10 p-[calc(2.5rem+var(--overscan))]">
        <aside className="col-span-4 flex min-h-0 flex-col gap-6">
          <p className="flex items-baseline justify-between">
            <time className="text-[clamp(5rem,8vw,9rem)] leading-[0.8] font-semibold tracking-[-0.05em]">
              {now.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
            </time>
            <span className="text-2xl text-muted capitalize">{now.toLocaleDateString("it-IT", { weekday: "long", day: "numeric" })}</span>
          </p>
          <div className="flex min-h-0 flex-1 items-center justify-center rounded-module bg-surface bg-dots p-6">
            <roby-face ref={face} expression={expression} mode={mode} background="transparent" color="currentColor" no-glow=""
              className="aspect-square h-full max-h-full max-w-full text-ink" />
          </div>
          {footer(panel)}
        </aside>
        <section aria-live="polite" className="col-span-8 flex min-h-0 flex-col">
          <PanelView panel={panel} state={state} now={now} />
        </section>
      </main>
      <Snow trigger={snow} />
    </div>
  );
}
