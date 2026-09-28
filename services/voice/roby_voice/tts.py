"""Sintesi vocale con Piper, voce italiana, in locale. Si parla a pezzi (frase per frase): il primo pezzo
esce prima che l'ultimo sia pronto."""

from collections.abc import Iterator

from .config import Config


class Piper:
    def __init__(self, cfg: Config) -> None:
        from piper import PiperVoice
        self._voice = PiperVoice.load(str(cfg.models / f"{cfg.piper_voice}.onnx"))
        self.rate: int = int(self._voice.config.sample_rate)

    def synthesize(self, text: str) -> Iterator[bytes]:
        for chunk in self._voice.synthesize(text):
            yield bytes(chunk.audio_int16_bytes)
