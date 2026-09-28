"""Microfono e altoparlante (sounddevice), più le versioni su file per provare senza (Docker, test).

- Il microfono manda blocchi da 80 ms a 16 kHz in una coda.
- L'altoparlante suona un flusso di pezzi PCM, si ferma quando glielo si chiede (barge-in) e intanto misura
  il volume ogni 33 ms: brain lo passa a /casa, che ci muove la bocca di Roby.
"""

import math
import queue
import struct
import threading
import time
import wave
from collections.abc import Callable, Iterable, Iterator
from pathlib import Path

from .ears import FRAME, RATE

LEVEL_MS = 33


def level(pcm: bytes) -> float:
    """Volume (0..1) di un pezzo: radice della media dei quadrati, scalata sulla voce parlata."""
    n = len(pcm) // 2
    if not n:
        return 0.0
    samples = struct.unpack(f"<{n}h", pcm[: n * 2])
    return min(1.0, math.sqrt(sum(s * s for s in samples) / n) / 6000)


def levels(pcm: bytes, rate: int, ms: int = LEVEL_MS) -> list[float]:
    """Il volume ogni `ms` millisecondi."""
    step = max(1, rate * ms // 1000) * 2
    return [level(pcm[i:i + step]) for i in range(0, len(pcm) - 1, step)]


def tone(freqs: Iterable[tuple[float, float]], rate: int, volume: float = 0.3) -> bytes:
    """Una sequenza di note (frequenza in Hz, durata in s; 0 Hz = pausa), con attacco e rilascio morbidi."""
    out = bytearray()
    for f, secs in freqs:
        n = int(rate * secs)
        fade = max(1, int(rate * 0.01))
        for i in range(n):
            env = min(1.0, i / fade, (n - i) / fade)
            v = volume * env * math.sin(2 * math.pi * f * i / rate) if f else 0.0
            out += struct.pack("<h", int(v * 32767))
    return bytes(out)


# Il bip "ti ascolto" e l'allarme dei timer (ripetuto finché non lo si ferma).
LISTEN = [(880.0, 0.08), (1320.0, 0.1)]
MUTE = [(660.0, 0.08), (440.0, 0.12)]
ALARM = [(988.0, 0.15), (0.0, 0.08), (988.0, 0.15), (0.0, 0.08), (988.0, 0.15), (0.0, 0.9)]


class Mic:
    """Il microfono vero: blocchi da 80 ms nella coda `out`, come ("audio", bytes)."""

    def __init__(self, out: "queue.Queue[tuple[object, ...]]", device: str = "") -> None:
        import sounddevice as sd
        self._stream = sd.RawInputStream(samplerate=RATE, channels=1, dtype="int16", blocksize=FRAME,
                                         device=_device(device), callback=lambda data, *_: out.put(("audio", bytes(data))))

    def start(self) -> None:
        self._stream.start()


class WavMic:
    """Un file WAV al posto del microfono (16 kHz mono), a velocità reale, poi silenzio."""

    def __init__(self, out: "queue.Queue[tuple[object, ...]]", path: Path, realtime: bool = True) -> None:
        self._out, self._path, self._realtime = out, path, realtime

    def start(self) -> None:
        threading.Thread(target=self._run, daemon=True).start()

    def _run(self) -> None:
        with wave.open(str(self._path)) as w:
            assert w.getframerate() == RATE and w.getnchannels() == 1, "serve un WAV mono a 16 kHz"
            pcm = w.readframes(w.getnframes())
        silence = b"\x00\x00" * FRAME
        frames = [pcm[i:i + FRAME * 2].ljust(FRAME * 2, b"\x00") for i in range(0, len(pcm), FRAME * 2)]
        for frame in [*frames, *[silence] * 40]:
            self._out.put(("audio", frame))
            if self._realtime:
                time.sleep(FRAME / RATE)
        while True:
            self._out.put(("audio", silence))
            time.sleep(FRAME / RATE)


class Speaker:
    """Suona una cosa alla volta, in un thread. `stop()` interrompe (barge-in, "basta")."""

    def __init__(self, device: str = "", out_dir: Path | None = None) -> None:
        self._device, self._out_dir = device, out_dir
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    @property
    def busy(self) -> bool:
        return self._thread is not None and self._thread.is_alive()

    def stop(self) -> None:
        self._stop.set()
        if self._thread and self._thread is not threading.current_thread():
            self._thread.join(timeout=2)

    def play(self, chunks: Iterable[bytes], rate: int, on_level: Callable[[float], None] | None = None,
             on_done: Callable[[bool], None] | None = None, loop: bool = False) -> None:
        """Suona i pezzi; alla fine `on_done(interrotto)`. Con `loop` ripete finché non lo si ferma (allarme)."""
        self.stop()
        self._stop = threading.Event()
        stop = self._stop

        def run() -> None:
            interrupted = False
            try:
                source: Iterator[bytes] = _cycle(list(chunks)) if loop else iter(chunks)
                with self._sink(rate) as write:
                    for chunk in source:
                        if stop.is_set():
                            interrupted = True
                            break
                        # A pezzi da ~33 ms: si può fermare in fretta, e ogni pezzo porta il suo volume.
                        step = rate * LEVEL_MS // 1000 * 2
                        for i in range(0, len(chunk), step):
                            if stop.is_set():
                                interrupted = True
                                break
                            piece = chunk[i:i + step]
                            if on_level:
                                on_level(level(piece))
                            write(piece)
                        if interrupted:
                            break
            finally:
                if on_done:
                    on_done(interrupted)

        self._thread = threading.Thread(target=run, daemon=True)
        self._thread.start()

    def _sink(self, rate: int) -> "_Sink":
        return _Sink(rate, self._device, self._out_dir)


class _Sink:
    """Dove va l'audio: la scheda audio, oppure (senza, in Docker) un file WAV suonato "a tempo"."""

    def __init__(self, rate: int, device: str, out_dir: Path | None) -> None:
        self._rate, self._device, self._out_dir = rate, device, out_dir
        self._stream: object | None = None
        self._wav: wave.Wave_write | None = None

    def __enter__(self) -> Callable[[bytes], None]:
        if self._out_dir is not None:
            self._out_dir.mkdir(parents=True, exist_ok=True)
            self._wav = wave.open(str(self._out_dir / f"{int(time.time() * 1000)}.wav"), "wb")
            self._wav.setnchannels(1)
            self._wav.setsampwidth(2)
            self._wav.setframerate(self._rate)
            wav = self._wav

            def to_file(pcm: bytes) -> None:
                wav.writeframes(pcm)
                time.sleep(len(pcm) / 2 / self._rate)
            return to_file
        import sounddevice as sd
        stream = sd.RawOutputStream(samplerate=self._rate, channels=1, dtype="int16", device=_device(self._device))
        stream.start()
        self._stream = stream
        return lambda pcm: stream.write(pcm)

    def __exit__(self, *_: object) -> None:
        if self._wav:
            self._wav.close()
        if self._stream is not None:
            self._stream.stop()  # type: ignore[attr-defined]
            self._stream.close()  # type: ignore[attr-defined]


def _cycle(chunks: list[bytes]) -> Iterator[bytes]:
    while True:
        yield from chunks


def _device(name: str) -> int | str | None:
    if not name:
        return None
    return int(name) if name.isdigit() else name
