import { test } from "node:test";
import assert from "node:assert/strict";
import { pickPlaylist, pickSearch } from "./music.ts";

const data = {
  artists: { items: [{ uri: "spotify:artist:dea", name: "Fabrizio De André" }] },
  tracks: { items: [{ uri: "spotify:track:1", name: "Bocca di rosa", artists: [{ name: "Fabrizio De André" }] }] },
  albums: { items: [{ uri: "spotify:album:1", name: "Creuza de mä", artists: [{ name: "Fabrizio De André" }] }] },
};

test("metti <query>: artista se il nome corrisponde, altrimenti il brano", () => {
  assert.deepEqual(pickSearch("de andre", data), { uri: "spotify:artist:dea", label: "Fabrizio De André" });
  assert.deepEqual(pickSearch("bocca di rosa", data), { uri: "spotify:track:1", label: "Bocca di rosa di Fabrizio De André" });
  assert.deepEqual(pickSearch("creuza", data, "album"), { uri: "spotify:album:1", label: "Creuza de mä di Fabrizio De André" });
  assert.equal(pickSearch("boh", {}), null);
});

test("le playlist dell'utente: nome esatto, poi le parole", () => {
  const mine = [{ uri: "spotify:playlist:a", name: "Sabato sera" }, { uri: "spotify:playlist:b", name: "Sabato" }];
  assert.equal(pickPlaylist("sabato", mine)?.uri, "spotify:playlist:b");
  assert.equal(pickPlaylist("sabato sera", mine)?.uri, "spotify:playlist:a");
  assert.equal(pickPlaylist("cena", mine), null);
});
