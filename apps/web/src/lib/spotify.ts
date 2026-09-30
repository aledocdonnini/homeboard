// Spotify dalla PWA, con le API ufficiali: comanda lo Spotify che hai aperto (app sul computer o sul telefono,
// una cassa, il "Roby" del Pi). Serve Premium.
//
// - Login con Authorization Code + PKCE: pensato per le app senza server, nessun segreto. Serve solo il Client ID
//   di un'app registrata su developer.spotify.com (NEXT_PUBLIC_SPOTIFY_CLIENT_ID), con redirect <origine>/spotify.
// - Il token sta su questo dispositivo (localStorage) e si rinnova da solo: il collegamento è per persona e dispositivo.
// - La scelta di cosa mettere è la stessa di Roby sul Pi (packages/core/src/music.ts).

import type { NowPlaying } from "@homeboard/core/protocol";
import { pickPlaylist, pickSearch, type Found, type Kind, type SearchResult } from "@homeboard/core/music";

export const CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID ?? "";
const SCOPES = "user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-read-private playlist-read-collaborative";
const KEY = "hb:spotify";
const API = "https://api.spotify.com/v1";

type Tokens = { access: string; refresh: string; expires: number };
const redirect = () => `${location.origin}/spotify`;

function load(): Tokens | null {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "null"); } catch { return null; }
}
function save(t: Tokens | null) {
  try { if (t) localStorage.setItem(KEY, JSON.stringify(t)); else localStorage.removeItem(KEY); } catch { /* storage bloccato */ }
}

export const connected = () => !!CLIENT_ID && !!load();
export const disconnect = () => save(null);

const b64url = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** Porta al login di Spotify; si torna su /spotify. */
export async function login() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  const state = b64url(crypto.getRandomValues(new Uint8Array(12)));
  const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  sessionStorage.setItem("hb:spotify:pkce", JSON.stringify({ verifier, state }));
  location.assign(`https://accounts.spotify.com/authorize?${new URLSearchParams({
    client_id: CLIENT_ID, response_type: "code", redirect_uri: redirect(), scope: SCOPES,
    code_challenge_method: "S256", code_challenge: challenge, state,
  })}`);
}

async function tokenRequest(body: Record<string, string>): Promise<Tokens> {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENT_ID, ...body }),
  });
  const data = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; error_description?: string };
  if (!res.ok || !data.access_token) throw new Error(data.error_description ?? `HTTP ${res.status}`);
  return { access: data.access_token, refresh: data.refresh_token ?? body.refresh_token ?? "", expires: Date.now() + (data.expires_in ?? 3600) * 1000 };
}

/** Ritorno dal login (pagina /spotify): scambia il codice con i token. */
export async function finishLogin(params: URLSearchParams) {
  const saved = JSON.parse(sessionStorage.getItem("hb:spotify:pkce") ?? "null") as { verifier: string; state: string } | null;
  sessionStorage.removeItem("hb:spotify:pkce");
  if (params.get("error")) throw new Error(params.get("error") === "access_denied" ? "Hai annullato il collegamento." : params.get("error")!);
  if (!saved || params.get("state") !== saved.state) throw new Error("Collegamento scaduto: riprova dalle Impostazioni.");
  save(await tokenRequest({ grant_type: "authorization_code", code: params.get("code") ?? "", redirect_uri: redirect(), code_verifier: saved.verifier }));
}

async function token(): Promise<string> {
  const t = load();
  if (!t) throw new Error("Spotify non è collegato");
  if (Date.now() < t.expires - 60_000) return t.access;
  const fresh = await tokenRequest({ grant_type: "refresh_token", refresh_token: t.refresh });
  save(fresh);
  return fresh.access;
}

export class NoDevice extends Error {}

async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T | null> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${await token()}`, ...(init.body ? { "Content-Type": "application/json" } : {}) },
  });
  if (res.status === 204) return null;
  if (res.status === 404 && path.startsWith("/me/player")) throw new NoDevice("Nessun dispositivo Spotify attivo");
  if (res.status === 401) { disconnect(); throw new Error("Collegamento a Spotify scaduto: ricollegalo dalle Impostazioni."); }
  if (!res.ok) throw new Error(`Spotify: HTTP ${res.status}`);
  return (res.headers.get("content-type")?.includes("json") ? res.json() : null) as Promise<T | null>;
}

type Player = {
  is_playing: boolean;
  device?: { id: string; name: string; volume_percent: number | null };
  context?: { uri: string } | null;
  item?: { name: string; artists?: { name: string }[]; album?: { name: string; images?: { url: string }[] } } | null;
};

/** Cosa suona adesso (null se niente). */
export async function nowPlaying(): Promise<(NowPlaying & { device: string }) | null> {
  const p = await api<Player>("/me/player").catch((e) => { if (e instanceof NoDevice) return null; throw e; });
  if (!p?.item) return null;
  return {
    title: p.item.name, artist: (p.item.artists ?? []).map((a) => a.name).join(", "), album: p.item.album?.name ?? "",
    context: null, cover: p.item.album?.images?.[0]?.url ?? null, playing: p.is_playing, device: p.device?.name ?? "",
  };
}

/** Se non c'è un dispositivo attivo si usa il primo disponibile (l'app Spotify aperta, il Pi…). */
async function withDevice(run: (deviceId?: string) => Promise<unknown>) {
  try {
    await run();
  } catch (e) {
    if (!(e instanceof NoDevice)) throw e;
    const list = await api<{ devices: { id: string; is_restricted: boolean }[] }>("/me/player/devices");
    const device = list?.devices.find((d) => !d.is_restricted);
    if (!device) throw new NoDevice("Apri Spotify su un dispositivo (telefono, computer o Roby) e riprova.");
    await run(device.id);
  }
}
const q = (deviceId?: string) => (deviceId ? `?device_id=${deviceId}` : "");

export async function find(query: string, kind?: Kind): Promise<Found | null> {
  if (!kind || kind === "playlist") {
    const mine = await api<{ items: { uri: string; name: string }[] }>("/me/playlists?limit=50");
    const hit = pickPlaylist(query, mine?.items ?? []);
    if (hit) return hit;
  }
  const types = kind ? [kind] : ["artist", "track", "album", "playlist"];
  const data = await api<SearchResult>(`/search?${new URLSearchParams({ q: query, type: types.join(","), limit: "3", market: "from_token" })}`);
  return pickSearch(query, data ?? {}, kind);
}

export const play = (uri: string) => withDevice((d) =>
  api(`/me/player/play${q(d)}`, { method: "PUT", body: JSON.stringify(uri.startsWith("spotify:track:") ? { uris: [uri] } : { context_uri: uri }) }));
export const resume = () => withDevice((d) => api(`/me/player/play${q(d)}`, { method: "PUT" }));
export const pause = () => api("/me/player/pause", { method: "PUT" });
export const next = () => api("/me/player/next", { method: "POST" });
export const prev = () => api("/me/player/previous", { method: "POST" });

/** Volume in percentuale, assoluto o relativo al volume attuale del dispositivo. */
export async function setVolume(percent: number, relative = false) {
  const current = relative ? (await api<Player>("/me/player"))?.device?.volume_percent ?? 50 : 0;
  const value = Math.max(0, Math.min(100, Math.round(relative ? current + percent : percent)));
  await api(`/me/player/volume?volume_percent=${value}`, { method: "PUT" });
}
