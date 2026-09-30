"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { WifiSlash } from "@phosphor-icons/react";
import type { HomeState } from "@homeboard/core/protocol";
import { arrange } from "@homeboard/core/items";
import { zonedDate } from "@homeboard/core/recurrence";
import { useOnline } from "@/lib/useOnline";
import { useRows } from "@/lib/useRows";
import Ask from "@/features/assistant/Ask";
import { useAssistant, type View } from "@/features/assistant/useAssistant";
import { open, type Deadline } from "@/features/deadlines/due";
import type { Household } from "@/features/household/HouseholdGate";
import { timezoneOf } from "@/features/household/HouseholdGate";
import { upcoming, type Reminder } from "@/features/reminders/schedule";
import { useShoppingList } from "@/features/shopping/useShoppingList";
import { useTimers } from "@/features/timers/useTimers";
import Station from "./Station";
import * as spotify from "@/lib/spotify";
import type { NowPlaying } from "@homeboard/core/protocol";

const DAY_MS = 86_400_000;

/**
 * La PWA sul computer: la stessa postazione della TV (Station), con i dati della PWA al posto di brain.
 * Niente tasti per cambiare sezione: si chiede a Roby, scrivendo o col microfono ("mostrami i promemoria").
 * `view`: la vista con cui si apre (il link /spesa mostra la spesa al centro).
 */
export default function DesktopStation({ house, view }: { house: Household; view: View }) {
  const tz = timezoneOf(house);
  const router = useRouter();
  const online = useOnline();
  const list = useShoppingList(house.id);
  const reminders = useRows<Reminder>("reminders", house.id);
  const deadlines = useRows<Deadline>("deadlines", house.id);
  const { timers } = useTimers(house.id);

  // Cosa suona su Spotify (se collegato su questo dispositivo), ogni 5 secondi e subito dopo un comando.
  const [music, setMusic] = useState<NowPlaying | null>(null);
  const refreshMusic = () => {
    if (!spotify.connected()) return;
    // Spotify aggiorna lo stato un attimo dopo il comando.
    setTimeout(() => void spotify.nowPlaying().then(setMusic).catch(() => {}), 800);
  };
  useEffect(() => {
    if (!spotify.connected()) return;
    const poll = () => void spotify.nowPlaying().then(setMusic).catch(() => {});
    poll();
    const every = setInterval(poll, 5000);
    return () => clearInterval(every);
  }, []);

  const assistant = useAssistant({
    householdId: house.id, tz, list, reminders: reminders.rows ?? [], deadlines: deadlines.rows ?? [], timers: timers ?? [],
    reload: () => { void reminders.reload(); void deadlines.reload(); },
    refreshMusic,
  });

  // La vista dell'indirizzo, una volta caricati i dati. "Oggi" è il riposo: non serve aprirla.
  const ready = reminders.rows !== undefined && deadlines.rows !== undefined && list.loaded;
  const { show } = assistant;
  useEffect(() => {
    if (ready && view !== "today") void show(view);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, view]);

  // "Apri le impostazioni" (e ogni vista che sul computer non è un pannello) porta alla pagina.
  const { reply } = assistant;
  useEffect(() => {
    if (reply?.go && reply.href && !reply.panel) router.push(reply.href);
  }, [reply, router]);

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(tick);
  }, []);
  const state: HomeState = {
    // Niente notte sul computer: il monoscopio "fine delle trasmissioni" è della TV.
    household: { name: house.name, timezone: tz, nightStart: "00:00", nightEnd: "00:00" },
    pairing: null,
    online,
    mic: "on",
    activity: assistant.busy ? "thinking" : "idle",
    timers: (timers ?? []).map((t) => ({ id: t.id, label: t.label, durationS: t.duration_s, endsAt: t.ends_at, status: t.status as "running" | "ringing" })),
    // Senza una vista chiesta si vede la giornata, invece del monoscopio: sul computer si lavora.
    answer: assistant.answer ?? { id: "oggi", said: "", reply: "", panel: { kind: "today" }, at: now.toISOString() },
    shopping: arrange(list.items).groups.flatMap((g) => g.items.map((i) => i.name)),
    reminders: upcoming(reminders.rows ?? [], now, tz).next.filter((u) => u.at.getTime() - now.getTime() < DAY_MS)
      .map((u) => ({ title: u.reminder.title, at: u.at.toISOString() })),
    deadlines: open(deadlines.rows ?? [], zonedDate(now, tz)).map((d) => ({ title: d.deadline.title, due: d.deadline.due_date })),
    arrivedAt: null,
    music,
  };

  return (
    <Station state={state} sticky
      footer={() => (
        <div className="flex flex-col gap-3 text-xl">
          <Ask assistant={assistant} replyHere={false} />
          {!online && <p className="flex items-center gap-2 text-muted"><WifiSlash aria-hidden weight="bold" className="size-6" /> Senza rete: la spesa funziona, il resto aspetta.</p>}
        </div>
      )} />
  );
}
