"""Sintesi vocale in locale, una frase alla volta: la prima esce prima che l'ultima sia pronta.
Due motori scelti da configurazione (ROBY_TTS):
- kokoro (predefinito): voce italiana molto più naturale (if_sara, im_nicola), più lenta;
- piper: velocissima anche sul Pi, voce meno riuscita. Misure: python -m roby_voice.bench --voci
"""

import re
from collections.abc import Iterator
from typing import Protocol

from .config import Config

# Frase per frase: dopo la punteggiatura forte (i numeri con la virgola non c'entrano: "10,5" non ha spazio).
_SENTENCE = re.compile(r"(?<=[.!?;:])\s+")


def sentences(text: str) -> list[str]:
    return [s for s in _SENTENCE.split(text.strip()) if s]


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


def tts(cfg: Config, name: str | None = None) -> Tts:
    return Piper(cfg) if (name or cfg.tts) == "piper" else Kokoro(cfg)
