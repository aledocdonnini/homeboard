"""Sintesi vocale, una frase alla volta: la prima esce prima che l'ultima sia pronta.
Tre motori scelti da configurazione (ROBY_TTS):
- edge (predefinito): voci neurali Microsoft (it-IT-DiegoNeural), le migliori in italiano. Servono internet e
  un servizio gratuito ma non ufficiale; il testo della risposta (mai l'audio del microfono) va a Microsoft.
  Le frasi già dette restano in cache sul Pi; senza rete, o se Edge non risponde, parla Kokoro.
- kokoro: in locale, voce italiana naturale (im_nicola, if_sara), più lenta di Piper;
- piper: in locale, velocissima anche sul Pi, voce meno riuscita.
Misure: python -m roby_voice.bench --voci
"""

import asyncio
import hashlib
import re
import subprocess
import sys
from collections.abc import Iterator
from pathlib import Path
from typing import Protocol

from .config import Config

# Frase per frase, ma solo alla fine vera di una frase: spezzare a ":" o ";" rompe l'intonazione ("Aggiunti:"
# detto da solo suona strano). I pezzi corti si uniscono al successivo.
_SENTENCE = re.compile(r"(?<=[.!?])\s+")
_MIN_CHARS = 40


def sentences(text: str) -> list[str]:
    out: list[str] = []
    for s in _SENTENCE.split(text.strip()):
        if out and len(out[-1]) < _MIN_CHARS:
            out[-1] = f"{out[-1]} {s}"
        elif s:
            out.append(s)
    return out


class Tts(Protocol):
    name: str
    rate: int

    def synthesize(self, text: str) -> Iterator[bytes]:
        """PCM mono a 16 bit, a pezzi."""
        ...


class Piper:
    name = "piper"

    def __init__(self, cfg: Config) -> None:
        from piper import PiperVoice
        self._voice = PiperVoice.load(str(cfg.models / f"{cfg.piper_voice}.onnx"))
        self.rate: int = int(self._voice.config.sample_rate)

    def synthesize(self, text: str) -> Iterator[bytes]:
        for chunk in self._voice.synthesize(text):
            yield bytes(chunk.audio_int16_bytes)


class Kokoro:
    name = "kokoro"
    rate = 24_000

    def __init__(self, cfg: Config) -> None:
        from kokoro_onnx import Kokoro as Model
        base = cfg.models / "kokoro"
        self._model = Model(str(base / cfg.kokoro_model), str(base / "voices-v1.0.bin"))
        self._voice, self._speed = cfg.kokoro_voice, cfg.kokoro_speed

    def synthesize(self, text: str) -> Iterator[bytes]:
        import numpy as np
        for sentence in sentences(text):
            audio, _ = self._model.create(sentence, voice=self._voice, speed=self._speed, lang="it")
            yield np.clip(audio * 32767, -32768, 32767).astype(np.int16).tobytes()


class Edge:
    """Edge TTS, con cache sul disco e una voce locale di riserva (stessa frequenza: 24 kHz, come Kokoro)."""

    name = "edge"
    rate = 24_000
    #: Oltre questo tempo per una frase si lascia perdere e parla la riserva.
    timeout = 3.0

    def __init__(self, cfg: Config, fallback: Tts | None) -> None:
        if fallback is not None and fallback.rate != self.rate:
            raise ValueError(f"la riserva di Edge deve essere a {self.rate} Hz (Kokoro), non {fallback.rate}")
        self._voice, self._speed, self._fallback = cfg.edge_voice, cfg.edge_rate, fallback
        self._cache = cfg.cache / "tts"
        self._cache.mkdir(parents=True, exist_ok=True)

    def synthesize(self, text: str) -> Iterator[bytes]:
        for sentence in sentences(text):
            pcm = self._cached(sentence) or self._fetch(sentence)
            if pcm:
                yield pcm
            elif self._fallback:
                yield from self._fallback.synthesize(sentence)

    def _path(self, sentence: str) -> Path:
        key = hashlib.sha1(f"{self._voice}|{self._speed}|{sentence}".encode()).hexdigest()
        return self._cache / f"{key}.pcm"

    def _cached(self, sentence: str) -> bytes | None:
        path = self._path(sentence)
        return path.read_bytes() if path.exists() else None

    def _fetch(self, sentence: str) -> bytes | None:
        try:
            mp3 = asyncio.run(asyncio.wait_for(self._download(sentence), self.timeout))
            pcm = decode_mp3(mp3, self.rate)
        except Exception as e:  # rete giù, Edge cambiato, ffmpeg mancante: parla la riserva
            print(f"Edge TTS non disponibile ({type(e).__name__}: {e}), uso la voce locale", file=sys.stderr, flush=True)
            return None
        self._path(sentence).write_bytes(pcm)
        return pcm

    async def _download(self, sentence: str) -> bytes:
        import edge_tts
        data = bytearray()
        async for chunk in edge_tts.Communicate(sentence, self._voice, rate=self._speed).stream():
            if chunk["type"] == "audio":
                data += chunk["data"]
        if not data:
            raise RuntimeError("nessun audio")
        return bytes(data)


def decode_mp3(mp3: bytes, rate: int) -> bytes:
    """MP3 → PCM mono a 16 bit con ffmpeg (sul Pi: apt install ffmpeg)."""
    return subprocess.run(["ffmpeg", "-loglevel", "error", "-i", "pipe:0", "-f", "s16le", "-ac", "1", "-ar", str(rate), "pipe:1"],
                          input=mp3, capture_output=True, check=True, timeout=10).stdout


def tts(cfg: Config, name: str | None = None) -> Tts:
    which = name or cfg.tts
    if which == "piper":
        return Piper(cfg)
    if which == "kokoro":
        return Kokoro(cfg)
    return Edge(cfg, Kokoro(cfg) if cfg.tts_fallback == "kokoro" else None)
