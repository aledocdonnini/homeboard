"""Misura dei motori di trascrizione: latenza e precisione (WER) su frasi di casa.

    python -m roby_voice.bench                       frasi sintetizzate con Piper (ottimistico: voce pulita)
    python -m roby_voice.bench --registra            registra dal microfono le frasi di bench/frasi.txt (sul Pi)
    python -m roby_voice.bench --dir registrate      misura sulle registrazioni vere
    --motori vosk,whisper-small,whisper-base          quali motori (predefiniti: vosk e whisper-small)
    python -m roby_voice.bench --voci                sintesi: Piper e Kokoro sulle risposte tipiche di Roby

Per ogni motore: tempo di caricamento, latenza media e al 90° percentile, RTF (tempo di calcolo / durata
dell'audio: sotto 1 è più veloce del parlato), WER medio e frasi trascritte senza errori.
"""

import argparse
import statistics
import time
import wave
from dataclasses import replace
from pathlib import Path

from .config import Config
from .ears import RATE
from .stt import SttEngine, VoskEngine, WhisperEngine
from .wer import wer

HERE = Path(__file__).resolve().parent.parent / "bench"


def _phrases() -> list[str]:
    return [line.strip() for line in (HERE / "frasi.txt").read_text().splitlines() if line.strip()]


def _write(path: Path, pcm: bytes) -> None:
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(pcm)


def synthesize(cfg: Config, out: Path) -> None:
    """Le frasi lette da Piper, riportate a 16 kHz come il microfono."""
    import numpy as np
    from scipy.signal import resample_poly

    from .tts import Piper
    out.mkdir(parents=True, exist_ok=True)
    piper = Piper(cfg)
    for i, text in enumerate(_phrases()):
        path = out / f"{i:02d}.wav"
        if not path.exists():
            audio = np.frombuffer(b"".join(piper.synthesize(text)), dtype=np.int16).astype(np.float32)
            resampled = resample_poly(audio, RATE, piper.rate)
            _write(path, np.clip(resampled, -32768, 32767).astype(np.int16).tobytes())
        (out / f"{i:02d}.txt").write_text(text)


def record(out: Path, seconds: float = 4.0) -> None:
    """Registra dal microfono una frase alla volta: si legge a voce la frase mostrata, dopo Invio."""
    import sounddevice as sd
    out.mkdir(parents=True, exist_ok=True)
    for i, text in enumerate(_phrases()):
        input(f"[{i + 1}/{len(_phrases())}] Invio, poi di': «{text}» ")
        pcm = sd.rec(int(seconds * RATE), samplerate=RATE, channels=1, dtype="int16")
        sd.wait()
        _write(out / f"{i:02d}.wav", pcm.tobytes())
        (out / f"{i:02d}.txt").write_text(text)


def _engine(cfg: Config, name: str) -> SttEngine:
    if name.startswith("whisper"):
        size = name.split("-", 1)[1] if "-" in name else cfg.whisper_model
        return WhisperEngine(cfg.models / f"whisper-{size}")
    return VoskEngine(cfg.models / cfg.vosk_model)


def measure(cfg: Config, folder: Path, names: list[str]) -> None:
    samples = []
    for wav in sorted(folder.glob("*.wav")):
        with wave.open(str(wav)) as w:
            samples.append((w.readframes(w.getnframes()), w.getnframes() / w.getframerate(), wav.with_suffix(".txt").read_text().strip()))
    print(f"{len(samples)} frasi da {folder}\n")
    print(f"{'motore':<16}{'carica':>8}{'media':>8}{'p90':>8}{'RTF':>7}{'WER':>7}{'esatte':>8}")
    for name in names:
        started = time.monotonic()
        stt = _engine(cfg, name)
        load = time.monotonic() - started
        stt.transcribe(samples[0][0], RATE)  # la prima chiamata scalda il motore: non conta
        times, rtf, errors, exact = [], [], [], 0
        for pcm, seconds, text in samples:
            t = time.monotonic()
            heard = stt.transcribe(pcm, RATE)
            dt = time.monotonic() - t
            times.append(dt)
            rtf.append(dt / seconds)
            e = wer(text, heard)
            errors.append(e)
            exact += e == 0
            if e:
                print(f"  {name}: «{text}» → «{heard}»")
        p90 = sorted(times)[int(len(times) * 0.9) - 1]
        print(f"{name:<16}{load:>7.1f}s{statistics.mean(times) * 1000:>6.0f}ms{p90 * 1000:>6.0f}ms"
              f"{statistics.mean(rtf):>7.2f}{statistics.mean(errors):>7.0%}{exact:>5}/{len(samples)}")


# Risposte tipiche di Roby (le dice brain): per misurare la sintesi.
REPLIES = [
    "Aggiunti: latte e uova.",
    "Da prendere: pane, caffè, pasta, latte, uova, burro e birra.",
    "Te lo ricordo domani alle 9:00: chiamare l'idraulico.",
    "Bollo auto scade tra 12 giorni, venerdì 10 ottobre.",
    "Timer pasta: 10 minuti.",
    "Mi hai detto: la chiave di scorta è da mia madre",
]


def voices(cfg: Config) -> None:
    """Per ogni motore: caricamento, attesa prima che esca la prima frase, RTF sull'insieme."""
    from .tts import tts
    print(f"{'voce':<22}{'carica':>8}{'prima frase':>13}{'RTF':>7}")
    for name in ("piper", "kokoro"):
        started = time.monotonic()
        engine = tts(cfg, name)
        load = time.monotonic() - started
        next(iter(engine.synthesize("Prova.")))  # scalda
        firsts, compute, audio = [], 0.0, 0.0
        for text in REPLIES:
            t = time.monotonic()
            first = True
            for chunk in engine.synthesize(text):
                if first:
                    firsts.append(time.monotonic() - t)
                    first = False
                audio += len(chunk) / 2 / engine.rate
            compute += time.monotonic() - t
        label = f"{name} {cfg.kokoro_voice}" if name == "kokoro" else f"{name} {cfg.piper_voice.split('-')[1]}"
        print(f"{label:<22}{load:>7.1f}s{statistics.mean(firsts) * 1000:>10.0f} ms{compute / audio:>7.2f}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--registra", action="store_true")
    parser.add_argument("--dir", type=Path)
    parser.add_argument("--motori", default="vosk,whisper-small")
    parser.add_argument("--voci", action="store_true")
    args = parser.parse_args()
    cfg = Config()
    if args.voci:
        return voices(cfg)
    if args.registra:
        return record(args.dir or HERE / "registrate")
    folder = args.dir
    if folder is None:
        folder = cfg.models / "bench-sintetiche"
        synthesize(replace(cfg), folder)
    measure(cfg, folder, args.motori.split(","))


if __name__ == "__main__":
    main()
