import type { Metadata } from "next";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import EmptyState from "@/components/ui/EmptyState";
import Field from "@/components/ui/Field";
import Big from "@/components/dash/Big";
import DotGrid from "@/components/dash/DotGrid";
import MonthDots from "@/components/dash/MonthDots";
import TickRuler from "@/components/dash/TickRuler";
import PageHeader from "@/components/ui/PageHeader";
import RobyTile from "@/components/ui/RobyTile";

export const metadata: Metadata = { title: "Stile · Homeboard", robots: { index: false } };

// Riferimento visivo dei token e dei componenti, da rivedere in chiaro e in scuro.
const SWATCHES = [
  { name: "paper", note: "plastica, lo sfondo" },
  { name: "surface", note: "moduli e campi" },
  { name: "ink", note: "testo, 14,5:1" },
  { name: "muted", note: "testo secondario, 4,9:1" },
  { name: "edge", note: "bordi dei controlli, 3,5:1" },
  { name: "dot-off", note: "pallini spenti" },
  { name: "accent", note: "l'unico colore: adesso, azione principale" },
  { name: "accent-text", note: "arancio come testo, 4,6:1" },
];

export default function Page() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-12 px-4 py-8">
      <PageHeader title="Stile" />

      <section aria-labelledby="colori" className="flex flex-col gap-4">
        <h2 id="colori" className="text-2xl font-semibold">Colori</h2>
        <p className="max-w-prose text-muted">Grigio da apparecchio, nero e un solo arancio, che segna una cosa per schermata.</p>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SWATCHES.map((c) => (
            <li key={c.name} className="flex flex-col gap-1">
              <div className="h-14 rounded-control border border-line" style={{ background: `var(--color-${c.name})` }} />
              <span className="font-semibold">{c.name}</span>
              <span className="text-sm text-muted">{c.note}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="caratteri" className="flex flex-col gap-4">
        <h2 id="caratteri" className="text-2xl font-semibold">Caratteri</h2>
        <div className="flex flex-col gap-3">
          <p className="text-8xl leading-[0.82] font-semibold tracking-[-0.05em]">03</p>
          <p className="text-4xl font-bold tracking-tight">Spesa di sabato</p>
          <p className="text-xl font-semibold">Frutta e verdura</p>
          <p className="max-w-prose text-lg">
            Archivo per tutto: i numeri giganti, i titoli e il testo corrente, con cifre a larghezza fissa.
          </p>
          <p className="text-muted">Testo secondario, per note e conteggi.</p>
          <p className="[font-stretch:75%] font-semibold text-6xl leading-none">00:02:57</p>
          <p className="text-sm text-muted">Archivo stretto per le letture da display: OSD, secondi, tasti.</p>
        </div>
      </section>

      <section aria-labelledby="componenti" className="flex flex-col gap-6">
        <h2 id="componenti" className="text-2xl font-semibold">Componenti</h2>
        <div className="flex flex-wrap gap-3">
          <Button>Aggiungi</Button>
          <Button variant="quiet">Esci</Button>
          <Button disabled>Invio in corso</Button>
          <Button variant="link">Togli dalla lista</Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="demo-ok" label="Email" placeholder="nome@esempio.it" hint="Ti mando un codice, niente password." />
          <Field id="demo-err" label="Codice di 6 cifre" defaultValue="12" error="Il codice ha 6 cifre." />
        </div>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-3 text-lg"><Checkbox /> Mele</label>
          <label className="flex items-center gap-3 text-lg"><Checkbox defaultChecked /> Latte</label>
        </div>
        <div className="flex flex-wrap items-end gap-8">
          <p className="flex items-end gap-3"><Big className="text-8xl">05</Big><span className="pb-2 text-xl text-muted">da prendere</span></p>
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="flex flex-col gap-2"><span className="text-sm text-muted">Pallini</span><DotGrid filled={5} total={7} cols={7} /></div>
          <div className="flex flex-col gap-2"><span className="text-sm text-muted">Righello</span><TickRuler daysLeft={3} span={20} /></div>
          <div className="flex flex-col gap-2"><span className="text-sm text-muted">Mese</span><MonthDots today={new Date(2026, 8, 25)} marked={[28]} /></div>
        </div>
      </section>

      <section aria-labelledby="roby" className="flex flex-col gap-4">
        <h2 id="roby" className="text-2xl font-semibold">Roby negli stati vuoti</h2>
        <div className="flex flex-wrap gap-3">
          {(["neutral", "happy", "excited", "listening", "surprised", "thinking", "confused", "worried", "sleepy"] as const).map((e) => (
            <RobyTile key={e} expression={e} className="size-16" />
          ))}
        </div>
        <EmptyState title="La lista è vuota">Scrivi qui sopra cosa manca. Puoi aggiungere più cose insieme, separate da virgole.</EmptyState>
      </section>
    </main>
  );
}
