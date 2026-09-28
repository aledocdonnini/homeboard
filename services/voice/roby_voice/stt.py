"""Trascrizione: un'interfaccia, due motori scelti da configurazione (ROBY_STT=vosk|whisper).

- Vosk: modello italiano piccolo, veloce anche sul Pi, meno preciso.
- faster-whisper: più preciso, più lento. Le misure sul Pi 5 vanno in docs (fase 5, bench.py).
"""

from typing import Protocol


class SttEngine(Protocol):
    name: str

    def transcribe(self, pcm: bytes, sample_rate: int) -> str:
        """Audio mono a 16 bit di una frase intera (già tagliata dal VAD) → testo."""
        ...
