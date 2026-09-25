import type { Metadata } from "next";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import EmptyState from "@/components/ui/EmptyState";
import Field from "@/components/ui/Field";
import Osd from "@/components/ui/Osd";
import PageHeader from "@/components/ui/PageHeader";
import RobyTile from "@/components/ui/RobyTile";

export const metadata: Metadata = { title: "Stile · Homeboard", robots: { index: false } };

// Riferimento visivo dei token e dei componenti, da rivedere in chiaro e in scuro.
const NEUTRALS = [
  { name: "paper", note: "sfondo" },
  { name: "surface", note: "campi e tasti" },
  { name: "ink", note: "testo, 16:1" },
  { name: "muted", note: "testo secondario, 5,9:1" },
  { name: "edge", note: "bordi dei controlli, 3,5:1" },
  { name: "line", note: "divisori" },
];
const CHANNELS = [
  { channel: "spesa", key: "2", name: "Verde", use: "Spesa", ratio: "5,6:1" },
  { channel: "promemoria", key: "3", name: "Giallo", use: "Promemoria", ratio: "10,1:1" },
  { channel: "scadenze", key: "4", name: "Rosso", use: "Scadenze", ratio: "4,5:1" },
  { channel: "casa", key: "", name: "Blu", use: "Casa", ratio: "5,6:1" },
];

export default function Page() {
  return (
    <main data-channel="spesa" className="mx-auto flex w-full max-w-2xl flex-col gap-12 px-4 py-8">
      <PageHeader title="Stile" />

      <section aria-labelledby="neutri" className="flex flex-col gap-4">
        <h2 id="neutri" className="text-2xl font-semibold">Neutri</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {NEUTRALS.map((c) => (
            <li key={c.name} className="flex flex-col gap-1">
              <div className="h-14 rounded-control border border-line" style={{ background: `var(--color-${c.name})` }} />
              <span className="font-semibold">{c.name}</span>
              <span className="text-sm text-muted">{c.note}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="canali" className="flex flex-col gap-4">
        <h2 id="canali" className="text-2xl font-semibold">Canali</h2>
        <p className="max-w-prose text-muted">
          I quattro colori del Televideo. Ogni sezione ha il suo e su una pagina compare solo quello.
          Il numero è il canale della TV che mostra la stessa cosa.
        </p>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {CHANNELS.map((c) => (
            <li key={c.channel} data-channel={c.channel}
              className="flex min-h-28 flex-col justify-between rounded-control border border-ink bg-channel p-3 text-on-channel">
              <span className="font-osd text-5xl leading-[0.8]">{c.key || " "}</span>
              <span className="font-semibold">{c.name}, {c.use}</span>
              <span className="text-sm">Testo sopra {c.ratio}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="caratteri" className="flex flex-col gap-4">
        <h2 id="caratteri" className="text-2xl font-semibold">Caratteri</h2>
        <div className="flex flex-col gap-3">
          <p className="text-4xl font-bold tracking-tight">Spesa di sabato</p>
          <p className="text-xl font-semibold">Frutta e verdura</p>
          <p className="max-w-prose text-lg">
            Atkinson Hyperlegible Next per tutto il testo: nata per chi vede poco, distingue bene I, l e 1 anche al sole.
          </p>
          <p className="text-muted">Testo secondario, per note e conteggi.</p>
          <p className="font-osd text-6xl leading-none">02 03 04</p>
          <p className="text-sm text-muted">VT323 solo per i numeri in stile OSD, sempre grandi.</p>
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
          <Osd value={5} label="da prendere" />
          <div data-channel="scadenze"><Osd value={12} label="giorni al bollo" /></div>
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
