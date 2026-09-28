"""Edge TTS: cache sul disco e voce locale di riserva, senza rete (download e decodifica finti)."""

from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest

from roby_voice import tts as tts_module
from roby_voice.config import Config
from roby_voice.tts import Edge


class FakeKokoro:
    name, rate = "kokoro", 24_000
    said: list[str] = []

    def synthesize(self, text: str) -> Iterator[bytes]:
        self.said.append(text)
        yield b"kk"


def make(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, online: bool) -> tuple[Edge, list[str]]:
    monkeypatch.setenv("ROBY_CACHE", str(tmp_path))
    asked: list[str] = []

    async def download(self: Edge, sentence: str) -> bytes:
        asked.append(sentence)
        if not online:
            raise OSError("rete giù")
        return b"mp3"

    monkeypatch.setattr(Edge, "_download", download)
    monkeypatch.setattr(tts_module, "decode_mp3", lambda mp3, rate: b"pcm")
    FakeKokoro.said = []
    return Edge(Config(), FakeKokoro()), asked


def test_scarica_e_poi_usa_la_cache(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    edge, asked = make(tmp_path, monkeypatch, online=True)
    assert list(edge.synthesize("Fermato.")) == [b"pcm"]
    assert list(edge.synthesize("Fermato.")) == [b"pcm"]
    assert asked == ["Fermato."], "la seconda volta arriva dalla cache"


def test_senza_rete_parla_la_riserva(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    edge, _ = make(tmp_path, monkeypatch, online=False)
    assert list(edge.synthesize("Me lo ricordo.")) == [b"kk"]
    assert FakeKokoro.said == ["Me lo ricordo."]


def test_la_riserva_deve_avere_la_stessa_frequenza(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ROBY_CACHE", str(tmp_path))
    slow: Any = type("P", (), {"name": "piper", "rate": 22_050})()
    with pytest.raises(ValueError):
        Edge(Config(), slow)
