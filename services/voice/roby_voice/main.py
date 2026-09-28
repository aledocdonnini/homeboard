"""voice: la parte audio della postazione. L'audio non lascia mai il Pi: a brain va solo testo.

    riposo ──"Ehi Roby" o tasto──▶ ascolto ──fine frase (VAD)──▶ trascrizione ──testo──▶ brain
       ▲                                                                                  │
       └──────────── fine del parlato ◀── Piper parla (bocca: volume a brain) ◀── "say" ──┘

- Barge-in: mentre Roby parla, "Ehi Roby" (o il tasto) lo interrompe e si ascolta subito.
- Allarme dei timer: suona finché brain non dice di smettere; intanto basta parlare ("basta"), senza parola
  di attivazione.
- Tasto microfono: niente ascolto finché non lo si ripreme; lo stato va a brain e si vede su /casa.

Uso: roby-voice                   microfono e altoparlante veri
     roby-voice --wav frase.wav   un file al posto del microfono (--subito: senza parola di attivazione)
     roby-voice --out cartella    le risposte in file WAV invece che all'altoparlante (Docker, niente audio)
"""

import argparse
import queue
import time
from pathlib import Path
from typing import Any, Literal

from .audio import ALARM, LISTEN, MUTE, Mic, Speaker, WavMic, tone
from .config import Config
from .ears import RATE, Ears
from .endpoint import Endpoint
from .keys import Keys
from .link import Link
from .stt import SttEngine, engine
from .tts import Piper

State = Literal["idle", "listening", "waiting", "speaking"]
# Con barge-in "vad": tanta voce di fila (240 ms) mentre Roby parla vuol dire che qualcuno lo interrompe.
BARGE_FRAMES = 3


class Voice:
    """La macchina a stati. Le dipendenze arrivano da fuori: nei test (tests/test_voice.py) sono finte."""

    def __init__(self, cfg: Config, events: "queue.Queue[tuple[Any, ...]]", link: Link, ears: Ears, stt: SttEngine,
                 tts: Piper, speaker: Speaker, subito: bool = False) -> None:
        self.cfg, self.events, self.link, self.ears, self.stt, self.tts, self.speaker = cfg, events, link, ears, stt, tts, speaker
        self.state: State = "idle"
        self.muted = False
        self.alarm = False
        self.endpoint = Endpoint()
        self.saying: str | None = None
        self.listen_after = False
        self.barge = 0
        if subito:
            self._listen("button", beep=False)

    # ——— Stati ———

    def _listen(self, by: Literal["word", "button"], beep: bool = True) -> None:
        self.ears.reset()
        self.endpoint = Endpoint()
        self.state = "listening"
        self.link.send({"type": "wake", "by": by})
        if beep:
            self.speaker.play([tone(LISTEN, self.tts.rate)], self.tts.rate)

    def _idle(self) -> None:
        self.state = "idle"
        if self.alarm and not self.speaker.busy:
            self._ring()

    def _ring(self) -> None:
        self.speaker.play([tone(ALARM, self.tts.rate, volume=0.5)], self.tts.rate, loop=True)

    def _interrupt(self) -> None:
        """Qualcuno parla sopra a Roby: si ferma subito e ascolta."""
        self.speaker.stop()  # on_done manda "spoken" con interrupted=True
        self._listen("word", beep=False)

    # ——— Eventi ———

    def on_audio(self, frame: bytes) -> None:
        if self.muted:
            return
        import numpy as np
        samples = np.frombuffer(frame, dtype=np.int16)

        if self.state == "listening":
            verdict = self.endpoint.push(frame, self.ears.speech(samples))
            if verdict == "nothing":
                self.link.send({"type": "nothing"})
                self._idle()
            elif verdict == "done":
                self.state = "waiting"
                started = time.monotonic()
                text = self.stt.transcribe(self.endpoint.audio(), RATE)
                ms = int((time.monotonic() - started) * 1000)
                print(f"[{self.stt.name} {ms} ms] {text!r}", flush=True)
                if text:
                    self.link.send({"type": "heard", "text": text, "engine": self.stt.name, "ms": ms})
                else:
                    self.link.send({"type": "nothing"})
                    self._idle()
            return

        if self.state in ("idle", "speaking"):
            if self.ears.wake(samples) >= self.cfg.wake_threshold:
                if self.state == "speaking" or self.alarm:
                    self.speaker.stop()
                    self._listen("word", beep=False)
                else:
                    self._listen("word")
                return
            # Mentre suona l'allarme basta parlare: "basta!" senza "Ehi Roby".
            if self.alarm and self.state == "idle" and self.ears.speech(samples) >= 0.6:
                self.speaker.stop()
                self._listen("word", beep=False)
                self.endpoint.push(frame, 1.0)
                return
            if self.state == "speaking" and self.cfg.barge_in == "vad":
                self.barge = self.barge + 1 if self.ears.speech(samples) >= 0.7 else 0
                if self.barge >= BARGE_FRAMES:
                    self._interrupt()

    def on_brain(self, msg: dict[str, Any]) -> None:
        kind = msg.get("type")
        if kind == "say":
            self.speaker.stop()
            self.state = "speaking"
            self.saying = str(msg["id"])
            self.listen_after = bool(msg.get("listen"))
            self.barge = 0
            said = self.saying
            self.link.send({"type": "speaking", "id": said})
            self.speaker.play(
                self.tts.synthesize(str(msg["text"])), self.tts.rate,
                on_level=lambda v: self.link.send({"type": "level", "value": round(v, 3)}),
                on_done=lambda interrupted: self.events.put(("spoken", said, interrupted)),
            )
        elif kind == "stop":
            self.speaker.stop()
        elif kind == "alarm":
            self.alarm = bool(msg.get("on"))
            if self.alarm and self.state == "idle":
                self._ring()
            elif not self.alarm and self.state != "speaking":
                self.speaker.stop()

    def on_spoken(self, said: str, interrupted: bool) -> None:
        self.link.send({"type": "spoken", "id": said, "interrupted": interrupted})
        if said != self.saying:
            return
        self.saying = None
        if self.state != "speaking":
            return  # interrotto: si sta già ascoltando
        if self.listen_after and not interrupted:
            self._listen("button", beep=False)  # "Confermi?": la risposta senza "Ehi Roby"
        else:
            self._idle()

    def on_key(self, code: int, pressed: bool) -> None:
        if not pressed:
            return
        if code == self.cfg.key_mute:
            self.muted = not self.muted
            self.link.send({"type": "mic", "muted": self.muted})
            self.speaker.play([tone(MUTE if self.muted else LISTEN, self.tts.rate)], self.tts.rate)
            if self.muted and self.state == "listening":
                self.link.send({"type": "nothing"})
                self.state = "idle"
        elif code == self.cfg.key_talk and not self.muted:
            if self.state == "speaking" or self.alarm:
                self.speaker.stop()
            self._listen("button")

    def run(self) -> None:
        self.link.start()
        while True:
            event = self.events.get()
            kind = event[0]
            if kind == "audio":
                self.on_audio(event[1])
            elif kind == "brain":
                self.on_brain(event[1])
            elif kind == "spoken":
                self.on_spoken(event[1], event[2])
            elif kind == "key":
                self.on_key(event[1], event[2])
            elif kind == "link":
                print("brain collegato" if event[1] else "brain non raggiungibile, riprovo…", flush=True)
                if event[1]:
                    self.link.send({"type": "mic", "muted": self.muted})


def main() -> None:
    parser = argparse.ArgumentParser(description="La voce di Roby.")
    parser.add_argument("--wav", type=Path, help="un file WAV (16 kHz mono) al posto del microfono")
    parser.add_argument("--subito", action="store_true", help="con --wav: ascolta subito, senza parola di attivazione")
    parser.add_argument("--out", type=Path, help="le risposte in file WAV in questa cartella, invece che all'altoparlante")
    args = parser.parse_args()

    cfg = Config()
    events: queue.Queue[tuple[Any, ...]] = queue.Queue()
    voice = Voice(cfg, events, Link(cfg.socket, events), Ears(cfg), engine(cfg), Piper(cfg), Speaker(cfg.output_device, args.out), subito=args.subito)
    source = WavMic(voice.events, args.wav) if args.wav else Mic(voice.events, cfg.input_device)
    Keys(cfg.keys_device, voice.events).start()
    source.start()
    print(f"voice: {cfg.stt}, parola «{cfg.wake_model}», brain su {cfg.socket}", flush=True)
    voice.run()


if __name__ == "__main__":
    main()
