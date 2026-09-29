"use client";

import { renderSVG } from "uqr";
import type { Answer, HomeState, HomeTimer } from "@homeboard/core/protocol";
import type { Panel, Soon } from "@homeboard/core/station";
import { countdown, secondsLeft } from "@homeboard/core/timers";
import { addDays, daysBetween, zonedDate } from "@homeboard/core/recurrence";
import Big from "@/components/dash/Big";
import TickRuler from "@/components/dash/TickRuler";
import Monoscope from "./Monoscope";

// I pannelli centrali della postazione. Si leggono da qualche metro: un'informazione alla volta, numeri enormi.
const two = (n: number) => String(Math.abs(n)).padStart(2, "0");
const name = (t: HomeTimer) => (t.label ? t.label[0]!.toUpperCase() + t.label.slice(1) : "Timer");
const toDate = (day: string) => new Date(`${day}T12:00:00`);
const days = (n: number) => (n < 0 ? (n === -1 ? "giorno di ritardo" : "giorni di ritardo") : n === 1 ? "giorno" : "giorni");

export default function PanelView({ panel, state, now }: { panel: Panel; state: HomeState; now: Date }) {
  switch (panel.kind) {
    case "pairing": return <Pairing code={state.pairing?.code ?? ""} />;
    case "ringing": return <Ringing timer={panel.timer} />;
    case "answer": {
      const view = panel.answer.panel;
      if (view.kind === "music") return <MusicPanel state={state} />;
      if (view.kind === "today" || view.kind === "timers" || view.kind === "deadlines" || view.kind === "reminders" || view.kind === "notes") {
        return <ViewPanel view={view} state={state} now={now} />;
      }
      return <AnswerPanel answer={panel.answer} />;
    }
    case "timers": return <Timers timers={panel.timers} now={now} />;
    case "soon": return <SoonPanel soon={panel.soon} />;
    case "idle": case "night":
      // Il pannello ha l'altezza della colonna: il monoscopio ci sta dentro intero, in 3:2.
      return <div className="relative min-h-0 flex-1"><div className="absolute inset-0"><Monoscope caption="Niente in programma" contain /></div></div>;
  }
}

function Ringing({ timer }: { timer: HomeTimer }) {
  return (
    <div className="flex h-full flex-col justify-center gap-6 rounded-module bg-accent p-12 text-on-accent">
      <p className="text-4xl font-semibold">Timer finito</p>
      <p className="text-[clamp(7rem,12vw,13rem)] leading-[0.85] font-semibold tracking-[-0.04em] break-words">{name(timer)}</p>
      <p className="text-4xl">Di&apos; &laquo;basta&raquo; per fermarlo.</p>
    </div>
  );
}

function Timers({ timers, now }: { timers: HomeTimer[]; now: Date }) {
  const [first, ...rest] = timers;
  if (!first) return null;
  return (
    <div className="flex h-full flex-col justify-center gap-8">
      <p className="text-3xl text-muted">{name(first)}</p>
      <Big className="text-[clamp(10rem,17vw,19rem)]">{countdown(secondsLeft(first.endsAt, now))}</Big>
      {rest.length > 0 && (
        <ul className="flex flex-col border-t-4 border-ink">
          {rest.map((t) => (
            <li key={t.id} className="flex items-baseline gap-8 border-b border-line py-5">
              <span className="w-[5ch] text-6xl font-semibold tracking-[-0.04em]">{countdown(secondsLeft(t.endsAt, now))}</span>
              <span className="text-4xl">{name(t)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SoonPanel({ soon }: { soon: Soon }) {
  const { reminder, deadline } = soon;
  return (
    <div className="flex h-full flex-col justify-center gap-12">
      {reminder && (
        <section aria-label="Promemoria" className="flex flex-col gap-4 border-t-4 border-ink pt-6">
          <p className="flex items-end gap-6">
            <Big className="text-[clamp(8rem,13vw,13rem)] text-accent-text">{two(reminder.minutes)}</Big>
            <span className="pb-4 text-4xl text-muted">{reminder.minutes === 1 ? "minuto" : "minuti"}</span>
          </p>
          <h2 className="text-6xl font-semibold tracking-tight">{reminder.title}</h2>
          <p className="text-3xl text-muted">alle {new Date(reminder.at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</p>
        </section>
      )}
      {deadline && (
        <section aria-label="Scadenza" className="flex flex-col gap-4 border-t-4 border-ink pt-6">
          <p className="flex items-end gap-6">
            <Big className={`${reminder ? "text-9xl" : "text-[clamp(8rem,13vw,13rem)]"} text-accent-text`}>{two(deadline.daysLeft)}</Big>
            <span className="pb-4 text-4xl text-muted">{days(deadline.daysLeft)}</span>
          </p>
          <h2 className="text-6xl font-semibold tracking-tight">{deadline.title}</h2>
          <p className="text-3xl text-muted">
            {deadline.daysLeft < 0 ? "scaduta" : "scade"} {toDate(deadline.due).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          {deadline.daysLeft >= 0 && <TickRuler daysLeft={deadline.daysLeft} />}
        </section>
      )}
    </div>
  );
}

function AnswerPanel({ answer }: { answer: Answer }) {
  const p = answer.panel;
  return (
    <div className="flex h-full flex-col justify-center gap-8">
      <p className="text-3xl text-muted">&laquo;{answer.said}&raquo;</p>
      {p.kind === "shopping" ? (
        <>
          <p className="flex items-end gap-6">
            <Big className="text-[clamp(8rem,12vw,12rem)]">{two(p.items.length)}</Big>
            <span className="pb-4 text-4xl text-muted">da prendere</span>
          </p>
          <ul className="columns-2 gap-12 border-t-4 border-ink pt-2">
            {p.items.slice(0, 12).map((item) => <li key={item} className="break-inside-avoid border-b border-line py-4 text-5xl font-semibold tracking-tight">{item}</li>)}
          </ul>
          {p.items.length > 12 && <p className="text-3xl text-muted">e altre {p.items.length - 12}</p>}
        </>
      ) : p.kind === "reminder" ? (
        <section className="flex flex-col gap-4 border-t-4 border-ink pt-6">
          <Big className="text-[clamp(8rem,12vw,12rem)]">{p.time}</Big>
          <p className="text-4xl text-muted capitalize">{toDate(p.date).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}</p>
          <h2 className="text-6xl font-semibold tracking-tight">{p.title}</h2>
        </section>
      ) : p.kind === "deadline" ? (
        <section className="flex flex-col gap-4 border-t-4 border-ink pt-6">
          <h2 className="text-6xl font-semibold tracking-tight">{p.title}</h2>
          <p className="text-4xl text-muted">scade {toDate(p.due).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
        </section>
      ) : p.kind === "note" ? (
        <blockquote className="border-l-8 border-accent pl-8 text-6xl leading-tight font-medium">{p.body}</blockquote>
      ) : null}
      {/* Sotto una nota la risposta la ripeterebbe: basta la nota. */}
      {p.kind !== "note" && <p className={`${p.kind === "text" ? "text-6xl leading-tight font-semibold" : "text-4xl leading-snug"}`}>{answer.reply}</p>}
    </div>
  );
}

function Pairing({ code }: { code: string }) {
  const url = `${location.origin}/abbina?codice=${code}`;
  return (
    <div className="grid h-full grid-cols-8 items-center gap-10">
      <div className="col-span-5 flex flex-col gap-8">
        <h1 className="text-6xl font-semibold tracking-tight">Abbina Roby alla tua casa</h1>
        <p className="text-3xl leading-snug text-muted">
          Inquadra il codice con il telefono, oppure apri Homeboard, vai su Impostazioni e scegli &laquo;Abbina una TV&raquo;.
        </p>
        <p aria-label={`Codice ${code.split("").join(" ")}`}>
          <Big className="text-[8rem] tracking-[0.08em]">{code || "······"}</Big>
        </p>
      </div>
      {code && (
        <div aria-hidden className="col-span-3 rounded-module bg-[#f4f3f0] p-6"
          dangerouslySetInnerHTML={{ __html: renderSVG(url, { border: 1, whiteColor: "#f4f3f0", blackColor: "#141414" }) }} />
      )}
    </div>
  );
}

// ——— Viste chieste a voce ("mostrami i promemoria") ————————————————————————————————

type View = Extract<Answer["panel"], { kind: "today" | "timers" | "deadlines" | "reminders" | "notes" }>;

const Heading = ({ children, count }: { children: string; count?: number }) => (
  <p className="flex items-end gap-6">
    {count !== undefined && <Big className="text-[clamp(7rem,11vw,11rem)]">{two(count)}</Big>}
    <span className="pb-3 text-4xl text-muted">{children}</span>
  </p>
);

function ViewPanel({ view, state, now }: { view: View; state: HomeState; now: Date }) {
  const tz = state.household?.timezone ?? "Europe/Rome";
  const today = zonedDate(now, tz), tomorrow = addDays(today, 1);
  const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("it-IT", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
  const dayOf = (iso: string) => {
    const d = zonedDate(new Date(iso), tz);
    return d === today ? "oggi" : d === tomorrow ? "domani" : toDate(d).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
  };
  const deadlines = state.deadlines.map((d) => ({ ...d, left: daysBetween(today, d.due) }));

  if (view.kind === "timers") {
    return state.timers.length ? <Timers timers={state.timers} now={now} /> : <Empty title="Nessun timer" hint="Di' «timer pasta dieci minuti»." />;
  }

  if (view.kind === "reminders") {
    if (!view.items.length) return <Empty title="Nessun promemoria" hint="Di' «ricordami domani alle nove di…»." />;
    return (
      <div className="flex h-full flex-col justify-center gap-6">
        <Heading count={view.items.length}>promemoria in arrivo</Heading>
        <ul className="border-t-4 border-ink">
          {view.items.slice(0, 7).map((r) => (
            <li key={r.title + r.at} className="flex items-baseline gap-8 border-b border-line py-4">
              <span className="w-[5ch] shrink-0 text-5xl font-semibold tracking-[-0.04em]">{hhmm(r.at)}</span>
              <span className="flex flex-col">
                <span className="text-4xl font-medium">{r.title}</span>
                <span className="text-2xl text-muted">{dayOf(r.at)}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (view.kind === "deadlines") {
    if (!deadlines.length) return <Empty title="Nessuna scadenza" hint="Bollette, bollo, revisione: aggiungile dal telefono." />;
    return (
      <div className="flex h-full flex-col justify-center gap-6">
        <Heading count={deadlines.length}>{deadlines.length === 1 ? "scadenza" : "scadenze"}</Heading>
        <ul className="border-t-4 border-ink">
          {deadlines.slice(0, 6).map((d) => (
            <li key={d.title + d.due} className="flex items-baseline gap-8 border-b border-line py-4">
              <span className={`w-[2.4ch] shrink-0 text-6xl font-semibold tracking-[-0.04em] ${d.left <= 7 ? "text-accent-text" : ""}`}>{two(d.left)}</span>
              <span className="flex flex-col">
                <span className="text-4xl font-medium">{d.title}</span>
                <span className="text-2xl text-muted">{days(d.left)}, {toDate(d.due).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (view.kind === "notes") {
    if (!view.items.length) return <Empty title="Nessuna nota" hint="Di' «ricorda che la chiave di scorta è da mia madre»." />;
    return (
      <div className="flex h-full flex-col justify-center gap-6">
        <Heading>ultime note</Heading>
        <ul className="border-t-4 border-ink">
          {view.items.slice(0, 6).map((n) => (
            <li key={n.body} className="flex flex-col gap-1 border-b border-line py-4">
              <span className="text-4xl leading-tight font-medium">{n.body}</span>
              <span className="text-2xl text-muted">{n.when}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // Oggi: il riepilogo della giornata.
  const todays = state.reminders.filter((r) => zonedDate(new Date(r.at), tz) === today);
  const close = deadlines.filter((d) => d.left <= 7);
  return (
    <div className="flex h-full flex-col justify-center gap-10">
      <p className="text-5xl font-semibold tracking-tight capitalize">{now.toLocaleDateString("it-IT", { timeZone: tz, weekday: "long", day: "numeric", month: "long" })}</p>
      <section className="flex flex-col border-t-4 border-ink">
        {todays.length ? todays.map((r) => (
          <p key={r.title + r.at} className="flex items-baseline gap-8 border-b border-line py-4">
            <span className="w-[5ch] text-5xl font-semibold tracking-[-0.04em]">{hhmm(r.at)}</span>
            <span className="text-4xl">{r.title}</span>
          </p>
        )) : <p className="border-b border-line py-4 text-3xl text-muted">Nessun promemoria oggi.</p>}
      </section>
      <div className="grid grid-cols-3 gap-8">
        <Figure value={state.shopping.length} label="da comprare" />
        <Figure value={close.length} label={close.length === 1 ? "scadenza vicina" : "scadenze vicine"} accent={close.length > 0} />
        <Figure value={state.timers.length} label={state.timers.length === 1 ? "timer attivo" : "timer attivi"} />
      </div>
    </div>
  );
}

const Figure = ({ value, label, accent = false }: { value: number; label: string; accent?: boolean }) => (
  <p className="flex flex-col gap-1 border-t border-line pt-4">
    <Big className={`text-8xl ${accent ? "text-accent-text" : ""}`}>{two(value)}</Big>
    <span className="text-2xl text-muted">{label}</span>
  </p>
);

const Empty = ({ title, hint }: { title: string; hint: string }) => (
  <div className="flex h-full flex-col justify-center gap-4">
    <p className="text-6xl font-semibold tracking-tight">{title}</p>
    <p className="text-3xl text-muted">{hint}</p>
  </div>
);

/** Spotify sul Pi: cosa suona, oppure il codice per collegare l'account. */
function MusicPanel({ state }: { state: HomeState }) {
  if (state.musicLink) {
    return (
      <div className="flex h-full flex-col justify-center gap-6">
        <p className="text-6xl font-semibold tracking-tight">Collega Spotify</p>
        <p className="text-3xl leading-snug text-muted">Dal telefono vai su <strong className="text-ink">spotify.com/pair</strong> e scrivi il codice:</p>
        <Big className="text-[8rem] tracking-[0.08em]">{state.musicLink.code}</Big>
      </div>
    );
  }
  const m = state.music;
  if (!m) return <Empty title="Non sta suonando niente" hint="Di' «metti De André» o «metti la playlist del sabato»." />;
  return (
    <div className="grid h-full grid-cols-8 items-center gap-10">
      {m.cover
        // eslint-disable-next-line @next/next/no-img-element -- copertina da Spotify, già dimensionata
        ? <img src={m.cover} alt="" className="col-span-3 aspect-square w-full rounded-module object-cover" />
        : <div aria-hidden className="col-span-3 aspect-square w-full rounded-module bg-surface bg-dots" />}
      <div className="col-span-5 flex flex-col gap-4">
        <p className="text-3xl text-muted">{m.playing ? "In onda" : "In pausa"}{m.context ? ` · ${m.context}` : ""}</p>
        <p className="text-7xl leading-[0.95] font-semibold tracking-tight">{m.title}</p>
        <p className="text-4xl">{m.artist}</p>
        <p className="text-2xl text-muted">{m.album}</p>
      </div>
    </div>
  );
}
