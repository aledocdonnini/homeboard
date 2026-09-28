"""Configurazione di voice, tutta da variabili d'ambiente (sul Pi: ~/.config/roby/voice.env, vedi device/)."""

import os
from dataclasses import dataclass, field
from pathlib import Path


def _env(key: str, default: str) -> str:
    return os.environ.get(key, default)


@dataclass(frozen=True)
class Config:
    models: Path = field(default_factory=lambda: Path(_env("ROBY_MODELS", str(Path.home() / ".local/share/roby/models"))).expanduser())
    socket: str = field(default_factory=lambda: _env("VOICE_SOCKET", os.path.join(os.environ.get("XDG_RUNTIME_DIR", "/tmp"), "roby.sock")))
    # Trascrizione: "vosk" (leggero, predefinito) o "whisper" (più preciso, più lento). Misure in README.
    stt: str = field(default_factory=lambda: _env("ROBY_STT", "vosk"))
    vosk_model: str = field(default_factory=lambda: _env("ROBY_VOSK_MODEL", "vosk-model-small-it-0.22"))
    whisper_model: str = field(default_factory=lambda: _env("ROBY_WHISPER_MODEL", "small"))
    cache: Path = field(default_factory=lambda: Path(_env("ROBY_CACHE", str(Path.home() / ".cache/roby"))).expanduser())
    # Sintesi: "edge" (voci Microsoft, serve internet; senza, parla la riserva), "kokoro" o "piper" (in locale).
    tts: str = field(default_factory=lambda: _env("ROBY_TTS", "edge"))
    tts_fallback: str = field(default_factory=lambda: _env("ROBY_TTS_FALLBACK", "kokoro"))
    edge_voice: str = field(default_factory=lambda: _env("ROBY_EDGE_VOICE", "it-IT-DiegoNeural"))
    edge_rate: str = field(default_factory=lambda: _env("ROBY_EDGE_RATE", "+0%"))
    kokoro_voice: str = field(default_factory=lambda: _env("ROBY_KOKORO_VOICE", "im_nicola"))
    kokoro_model: str = field(default_factory=lambda: _env("ROBY_KOKORO_MODEL", "kokoro-v1.0.onnx"))
    kokoro_speed: float = field(default_factory=lambda: float(_env("ROBY_KOKORO_SPEED", "1.0")))
    piper_voice: str = field(default_factory=lambda: _env("ROBY_PIPER_VOICE", "it_IT-paola-medium"))
    # Parola di attivazione: "ehi_roby" quando c'è il modello addestrato (README), finché no "hey_jarvis".
    wake_model: str = field(default_factory=lambda: _env("ROBY_WAKE_MODEL", "hey_jarvis"))
    wake_threshold: float = field(default_factory=lambda: float(_env("ROBY_WAKE_THRESHOLD", "0.5")))
    # Barge-in: "wake" (dire di nuovo "Ehi Roby" interrompe) o "vad" (basta parlare: solo con un microfono che
    # cancella l'eco, come il ReSpeaker, altrimenti Roby si interrompe da solo sentendo la propria voce).
    barge_in: str = field(default_factory=lambda: _env("ROBY_BARGE_IN", "wake"))
    # Microfono e altoparlante: nome o indice sounddevice (vuoto = predefiniti).
    input_device: str = field(default_factory=lambda: _env("ROBY_INPUT_DEVICE", ""))
    output_device: str = field(default_factory=lambda: _env("ROBY_OUTPUT_DEVICE", ""))
    # Tasti del televisore (gpio-key, device/config/config.txt): dispositivo di input e codici dei tasti.
    keys_device: str = field(default_factory=lambda: _env("ROBY_KEYS_DEVICE", ""))
    key_mute: int = field(default_factory=lambda: int(_env("ROBY_KEY_MUTE", "2")))  # KEY_1
    key_talk: int = field(default_factory=lambda: int(_env("ROBY_KEY_TALK", "3")))  # KEY_2
