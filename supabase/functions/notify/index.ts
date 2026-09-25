// Edge Function `notify`: manda le notifiche push di promemoria e scadenze.
//
// - POST con "Authorization: Bearer <NOTIFY_SECRET>": il giro di pg_cron, ogni minuto.
// - POST con il JWT di un utente: "Invia una prova" dalla PWA, solo ai dispositivi di chi la chiede.
//
// Cosa mandare lo decide notify-plan.ts (puro, testato). Qui: leggere, registrare, inviare.
// Ogni messaggio prima si registra in notification_log: se il giro si ripete non parte due volte.
// Le chiavi private (VAPID, service role) stanno solo nei secret della funzione.

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { planDeadlines, planReminders, type Message } from "../_shared/notify-plan.ts";
import { addDays } from "../_shared/recurrence.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});
webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT")!, Deno.env.get("VAPID_PUBLIC_KEY")!, Deno.env.get("VAPID_PRIVATE_KEY")!);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

type Payload = Pick<Message, "title" | "body" | "url" | "tag">;

/** Manda a tutti i dispositivi di questi utenti. Le iscrizioni scadute (404/410) si cancellano. */
async function sendToUsers(userIds: string[], payload: Payload) {
  if (!userIds.length) return { sent: 0, removed: 0 };
  const { data: subs, error } = await db.from("push_subscriptions").select("endpoint, p256dh, auth").in("user_id", userIds);
  if (error) throw error;
  let sent = 0, removed = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), {
        TTL: 60 * 60, urgency: "high",
      });
      sent++;
      await db.from("push_subscriptions").update({ last_ok_at: new Date().toISOString() }).eq("endpoint", s.endpoint);
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        removed++;
        await db.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      } else {
        console.error("push non inviata", status, (e as Error).message);
      }
    }
  }));
  return { sent, removed };
}

async function tick() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const [reminders, deadlines, houses, members] = await Promise.all([
    db.from("reminders").select("id, household_id, title, note, start_date, at_time, recurrence, next_at")
      .is("deleted_at", null).not("next_at", "is", null).lte("next_at", now.toISOString()),
    // Gli anticipi arrivano al massimo a un anno: basta guardare le scadenze aperte da ieri a fra 13 mesi.
    db.from("deadlines").select("id, household_id, title, due_date, notify_days")
      .is("deleted_at", null).is("done_at", null).gte("due_date", addDays(today, -1)).lte("due_date", addDays(today, 400)),
    db.from("households").select("id, timezone"),
    db.from("household_members").select("household_id, user_id"),
  ]);
  for (const r of [reminders, deadlines, houses, members]) if (r.error) throw r.error;

  const tzOf = (hid: string) => houses.data!.find((h) => h.id === hid)?.timezone ?? "Europe/Rome";
  const { messages: due, updates } = planReminders(reminders.data as never, now, tzOf);
  const messages = [...due, ...planDeadlines(deadlines.data!, now, tzOf)];

  // Registro prima di inviare: le righe già presenti (giro ripetuto) non tornano, e quei messaggi non partono.
  const claimed = messages.length
    ? await db.from("notification_log")
      .upsert(messages.map((m) => ({ kind: m.kind, item_id: m.item_id, key: m.key })), { onConflict: "kind,item_id,key", ignoreDuplicates: true })
      .select("kind, item_id, key")
    : { data: [], error: null };
  if (claimed.error) throw claimed.error;
  const fresh = messages.filter((m) => claimed.data!.some((c) => c.kind === m.kind && c.item_id === m.item_id && c.key === m.key));

  let sent = 0, removed = 0;
  for (const m of fresh) {
    const users = members.data!.filter((x) => x.household_id === m.household_id).map((x) => x.user_id);
    const r = await sendToUsers(users, { title: m.title, body: m.body, url: m.url, tag: m.tag });
    sent += r.sent;
    removed += r.removed;
  }
  await Promise.all(updates.map((u) => db.from("reminders").update({ next_at: u.next_at }).eq("id", u.id)));
  return { messages: fresh.length, skipped: messages.length - fresh.length, advanced: updates.length, sent, removed };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const auth = req.headers.get("Authorization") ?? "";
  try {
    if (auth === `Bearer ${Deno.env.get("NOTIFY_SECRET")}`) return json(await tick());
    // Prova dalla PWA: il JWT dell'utente, verificato qui (verify_jwt è spento per far passare pg_cron).
    const { data, error } = await db.auth.getUser(auth.replace(/^Bearer /, ""));
    if (error || !data.user || data.user.is_anonymous) return json({ error: "Non autorizzato" }, 401);
    return json(await sendToUsers([data.user.id], { title: "Homeboard", body: "Le notifiche funzionano su questo dispositivo.", url: "/casa", tag: "prova" }));
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});
