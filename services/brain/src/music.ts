// La musica: Spotify sul Pi. go-librespot fa del Pi un altoparlante Spotify Connect ("Roby") e ha un piccolo
// server locale (http://127.0.0.1:3678, device/config/go-librespot.yml) per comandarlo: è quello che usa brain.
// - L'account si collega una volta sola: go-librespot mostra un codice (spotify.com/pair), brain lo passa a /casa.
// - "Metti la playlist del sabato": prima fra le playlist dell'account (/library/playlists), poi nel catalogo
//   (Web API di Spotify, col token della sessione del Pi: /token).
// - Mentre Roby ascolta o parla, la musica si abbassa e poi torna com'era.
// Senza go-librespot (sul Mac, o se non è installato) tutto questo risponde "la musica non c'è".

import type { NowPlaying } from "@homeboard/core/protocol";
import { pickPlaylist, pickSearch, type Found, type Kind, type SearchResult } from "@homeboard/core/music";

const BASE = (process.env.LIBRESPOT_URL ?? "http://127.0.0.1:3678").replace(/\/+$/, "");
/** Mentre Roby ascolta o parla, la musica scende a questa frazione del volume. */
const DUCK = 0.25;

type Track = { name: string; artist_names: string[]; album_name: string; album_cover_url: string | null };
type Status = { stopped: boolean; paused: boolean; context_name: string | null; track: Track | null };

export type { Found, Kind };

export class Music {
  now: NowPlaying | null = null;
  link: { url: string; code: string } | null = null;
  /** go-librespot risponde (installato e acceso). */
  available = false;
  #ducked: number | null = null;

  async #call(path: string, init?: RequestInit): Promise<Response> {
    return fetch(`${BASE}${path}`, { ...init, signal: AbortSignal.timeout(3000), headers: { "Content-Type": "application/json", ...init?.headers } });
  }
  async #post(path: string, body?: unknown) {
    const res = await this.#call(path, { method: "POST", ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    if (!res.ok) throw new Error(`go-librespot ${path}: HTTP ${res.status}`);
  }

  /** Aggiorna cosa suona e il codice di collegamento. Da chiamare spesso (ogni pochi secondi). */
  async refresh(): Promise<boolean> {
    const before = JSON.stringify([this.now, this.link, this.available]);
    try {
      // Prima il codice: finché l'account non è collegato, /status non risponde (resta in attesa della sessione).
      const code = await this.#call("/auth/code");
      this.available = true;
      this.link = code.status === 200 ? ((await code.json()) as { url: string; code: string }) : null;
      if (this.link) {
        this.now = null;
      } else {
        const res = await this.#call("/status");
        const s = res.status === 200 ? ((await res.json()) as Status) : null;
        this.now = s?.track && !s.stopped ? {
          title: s.track.name, artist: s.track.artist_names.join(", "), album: s.track.album_name,
          context: s.context_name, cover: s.track.album_cover_url, playing: !s.paused,
        } : null;
      }
    } catch {
      this.available = false;
      this.now = null;
      this.link = null;
    }
    return JSON.stringify([this.now, this.link, this.available]) !== before;
  }

  pause = () => this.#post("/player/pause");
  resume = () => this.#post("/player/resume");
  next = () => this.#post("/player/next");
  prev = () => this.#post("/player/prev");
  play = (uri: string) => this.#post("/player/play", { uri });

  async volume(): Promise<{ value: number; max: number }> {
    const res = await this.#call("/player/volume");
    return (await res.json()) as { value: number; max: number };
  }
  /** Volume in percentuale (0-100), assoluto o relativo. */
  async setVolume(percent: number, relative = false) {
    const { max } = await this.volume();
    this.#ducked = null; // chi lo cambia a voce decide lui: dopo non si "ripristina" il vecchio
    await this.#post("/player/volume", { volume: Math.round((percent / 100) * max), relative });
  }

  /** Musica più bassa mentre Roby ascolta o parla. */
  async duck() {
    if (!this.now?.playing || this.#ducked !== null) return;
    try {
      const { value } = await this.volume();
      this.#ducked = value;
      await this.#post("/player/volume", { volume: Math.round(value * DUCK) });
    } catch {
      this.#ducked = null;
    }
  }
  /** E poi com'era. */
  async restore() {
    if (this.#ducked === null) return;
    const value = this.#ducked;
    this.#ducked = null;
    try {
      await this.#post("/player/volume", { volume: value });
    } catch { /* go-librespot riavviato: riparte col suo volume */ }
  }

  /** Cosa mettere per "metti <query>": playlist dell'account, poi il catalogo (scelta in packages/core/src/music.ts). */
  async find(query: string, kind?: Kind): Promise<Found | null> {
    if (!kind || kind === "playlist") {
      const res = await this.#call("/library/playlists?limit=500");
      if (res.status === 200) {
        const hit = pickPlaylist(query, ((await res.json()) as { items: { uri: string; name: string }[] }).items);
        if (hit) return hit;
      }
    }
    const tokenRes = await this.#call("/token", { method: "POST" });
    if (tokenRes.status !== 200) return null;
    const { token } = (await tokenRes.json()) as { token: string };
    const types = kind ? [kind] : ["artist", "track", "album", "playlist"];
    const url = `https://api.spotify.com/v1/search?${new URLSearchParams({ q: query, type: types.join(","), limit: "3", market: "from_token" })}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`Ricerca Spotify: HTTP ${res.status}`);
    return pickSearch(query, (await res.json()) as SearchResult, kind);
  }
}
