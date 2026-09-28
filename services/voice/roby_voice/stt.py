"""Trascrizione: un'interfaccia, due motori scelti da configurazione (ROBY_STT=vosk|whisper).

- Vosk: modello italiano piccolo, veloce anche sul Pi, meno preciso.
- faster-whisper: più preciso, più lento. Le misure (bench.py) sono nel README.
Le librerie si importano solo qui dentro: il resto del pacchetto (e i test) non ne ha bisogno.
"""

import json
from pathlib import Path
from typing import Protocol

from .config import Config

# Parole di casa: a Whisper un esempio di come si parla qui migliora nomi e numeri.
_PROMPT = "Aggiungi latte e uova alla spesa. Timer pasta dieci minuti. Ricordami domani alle nove di chiamare l'idraulico."


class SttEngine(Protocol):
    name: str

    def transcribe(self, pcm: bytes, sample_rate: int) -> str:
        """Audio mono a 16 bit di una frase intera (già tagliata dal VAD) → testo."""
        ...


class VoskEngine:
    name = "vosk"

    def __init__(self, path: Path) -> None:
        from vosk import Model, SetLogLevel
        SetLogLevel(-1)
        self._model = Model(str(path))

    def transcribe(self, pcm: bytes, sample_rate: int) -> str:
        from vosk import KaldiRecognizer
        rec = KaldiRecognizer(self._model, sample_rate)
        rec.AcceptWaveform(pcm)
        return str(json.loads(rec.FinalResult()).get("text", "")).strip()


class WhisperEngine:
    name = "whisper"

    def __init__(self, path: Path, threads: int = 4) -> None:
        from faster_whisper import WhisperModel
        self._model = WhisperModel(str(path), device="cpu", compute_type="int8", cpu_threads=threads)

    def transcribe(self, pcm: bytes, sample_rate: int) -> str:
        import numpy as np
        audio = np.frombuffer(pcm, dtype=np.int16).astype(np.float32) / 32768.0
        segments, _ = self._model.transcribe(audio, language="it", beam_size=1, condition_on_previous_text=False,
                                             vad_filter=False, initial_prompt=_PROMPT)
        return " ".join(s.text.strip() for s in segments).strip()


def engine(cfg: Config, name: str | None = None) -> SttEngine:
    which = name or cfg.stt
    if which == "whisper":
        return WhisperEngine(cfg.models / f"whisper-{cfg.whisper_model}")
    return VoskEngine(cfg.models / cfg.vosk_model)
