// Cosa mettere per "metti <query>": la stessa scelta sul Pi (brain, go-librespot) e nella PWA (API di Spotify).

export type Kind = "playlist" | "artist" | "album" | "track";
export type Found = { uri: string; label: string };
type Item = { uri: string; name: string; artists?: { name: string }[] } | null;
/** La risposta di GET /v1/search (solo i campi che servono). */
export type SearchResult = Partial<Record<`${Kind}s`, { items: Item[] }>>;

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
/** "de andre" e "Fabrizio De André" sono la stessa cosa; "dalla" non è "Dalla Porta"? sì: basta che le parole ci siano. */
export const sameName = (said: string, name: string) => {
  const a = fold(said).split(" "), b = fold(name).split(" ");
  return a.length > 0 && a.every((w) => b.includes(w));
};

/** Fra le playlist dell'utente, quella che si chiama così (nome esatto, poi le parole contenute). */
export function pickPlaylist(query: string, playlists: { uri: string; name: string }[]): Found | null {
  const hit = playlists.find((p) => fold(p.name) === fold(query)) ?? playlists.find((p) => sameName(query, p.name));
  return hit ? { uri: hit.uri, label: `la playlist ${hit.name}` } : null;
}

/**
 * Dal catalogo. Con un tipo detto ("l'album…") il primo di quel tipo. Senza: l'artista se il nome corrisponde
 * ("metti De André"), altrimenti il primo brano, album, playlist, artista.
 */
export function pickSearch(query: string, data: SearchResult, kind?: Kind): Found | null {
  const first = (k: Kind) => data[`${k}s`]?.items.find((i): i is NonNullable<Item> => !!i) ?? null;
  const artist = first("artist");
  if (!kind && artist && sameName(query, artist.name)) return { uri: artist.uri, label: artist.name };
  for (const k of kind ? [kind] : (["track", "album", "playlist", "artist"] as Kind[])) {
    const i = first(k);
    if (i) return { uri: i.uri, label: i.artists?.length ? `${i.name} di ${i.artists[0]!.name}` : i.name };
  }
  return null;
}
