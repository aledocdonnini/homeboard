"""La macchina a stati di voice, con orecchie, trascrizione, voce e altoparlante finti."""

import queue
from typing import Any, Callable, Iterable, cast

from roby_voice.config import Config
from roby_voice.main import Voice

FRAME = b"\x00\x00" * 1280


class FakeEars:
    def __init__(self) -> None:
        self.wake_next = 0.0
        self.speech_next = 0.0

    def wake(self, _: Any) -> float:
        return self.wake_next

    def speech(self, _: Any) -> float:
        return self.speech_next

    def reset(self) -> None:
        self.wake_next = 0.0


class FakeStt:
    name = "finto"
    text = "timer pasta dieci minuti"

    def transcribe(self, pcm: bytes, rate: int) -> str:
        return self.text


class FakeTts:
    rate = 16000

    def synthesize(self, text: str) -> Iterable[bytes]:
        return [b"\x10\x00" * 100]


class FakeSpeaker:
    def __init__(self) -> None:
        self.playing: list[str] = []
        self.done: Callable[[bool], None] | None = None
        self.loop = False

    @property
    def busy(self) -> bool:
        return self.done is not None or self.loop

    def play(self, chunks: Iterable[bytes], rate: int, on_level: Any = None, on_done: Callable[[bool], None] | None = None, loop: bool = False) -> None:
        self.stop()
        self.playing.append("alarm" if loop else "say" if on_done else "beep")
        self.done, self.loop = on_done, loop

    def stop(self) -> None:
        done, self.done, self.loop = self.done, None, False
        if done:
            done(True)

    def finish(self) -> None:
        done, self.done = self.done, None
        if done:
            done(False)


class FakeLink:
    def __init__(self) -> None:
        self.sent: list[dict[str, Any]] = []

    def send(self, msg: Any) -> None:
        self.sent.append(msg)

    def types(self) -> list[str]:
        return [m["type"] for m in self.sent]


def state(v: Voice) -> str:
    """Lo stato letto "da fuori" (mypy non restringe il tipo fra un evento e l'altro)."""
    return v.state


def make() -> tuple[Voice, FakeEars, FakeSpeaker, FakeLink]:
    ears, speaker, link = FakeEars(), FakeSpeaker(), FakeLink()
    v = Voice(Config(), queue.Queue(), cast(Any, link), cast(Any, ears), FakeStt(), cast(Any, FakeTts()), cast(Any, speaker))
    return v, ears, speaker, link


def drain(v: Voice) -> None:
    while not v.events.empty():
        e = v.events.get()
        if e[0] == "spoken":
            v.on_spoken(e[1], e[2])


def speak_phrase(v: Voice, ears: FakeEars) -> None:
    ears.speech_next = 0.9
    for _ in range(5):
        v.on_audio(FRAME)
    ears.speech_next = 0.0
    for _ in range(10):
        v.on_audio(FRAME)


def test_parola_poi_frase_poi_risposta() -> None:
    v, ears, speaker, link = make()
    ears.wake_next = 0.9
    v.on_audio(FRAME)
    assert state(v) == "listening" and link.sent[-1] == {"type": "wake", "by": "word"}
    speak_phrase(v, ears)
    assert state(v) == "waiting"
    assert link.sent[-1]["type"] == "heard" and link.sent[-1]["text"] == "timer pasta dieci minuti"
    v.on_brain({"type": "say", "id": "r1", "text": "Timer pasta: 10 minuti."})
    assert state(v) == "speaking" and speaker.playing[-1] == "say"
    speaker.finish()
    drain(v)
    assert state(v) == "idle" and link.sent[-1] == {"type": "spoken", "id": "r1", "interrupted": False}


def test_silenzio_dopo_la_parola() -> None:
    v, ears, _, link = make()
    ears.wake_next = 0.9
    v.on_audio(FRAME)
    for _ in range(70):
        v.on_audio(FRAME)
    assert state(v) == "idle" and link.types()[-1] == "nothing"


def test_barge_in_con_la_parola() -> None:
    v, ears, speaker, link = make()
    v.on_brain({"type": "say", "id": "r1", "text": "Una frase lunga."})
    ears.wake_next = 0.9
    v.on_audio(FRAME)
    drain(v)
    assert state(v) == "listening", "Roby si interrompe e ascolta"
    assert {"type": "spoken", "id": "r1", "interrupted": True} in link.sent


def test_confermi_ascolta_senza_parola() -> None:
    v, _, speaker, link = make()
    v.on_brain({"type": "say", "id": "r1", "text": "Tolgo tutto? Dimmi sì o no.", "listen": True})
    speaker.finish()
    drain(v)
    assert state(v) == "listening"
    assert link.sent[-1] == {"type": "wake", "by": "button"}


def test_allarme_e_basta_senza_parola() -> None:
    v, ears, speaker, link = make()
    v.on_brain({"type": "alarm", "on": True})
    assert speaker.playing[-1] == "alarm"
    ears.speech_next = 0.9
    v.on_audio(FRAME)
    assert state(v) == "listening" and not speaker.loop, "si parla sopra l'allarme: si ascolta"
    FakeStt.text = "basta"
    speak_phrase(v, ears)
    assert link.sent[-1]["text"] == "basta"
    FakeStt.text = "timer pasta dieci minuti"
    v.on_brain({"type": "alarm", "on": False})
    v.on_brain({"type": "say", "id": "r2", "text": "Fermato."})
    speaker.finish()
    drain(v)
    assert state(v) == "idle" and not speaker.loop


def test_tasto_muto() -> None:
    v, ears, _, link = make()
    v.on_key(v.cfg.key_mute, True)
    assert link.sent[-1] == {"type": "mic", "muted": True}
    ears.wake_next = 0.9
    v.on_audio(FRAME)
    assert state(v) == "idle", "col microfono spento non si ascolta"
    v.on_key(v.cfg.key_mute, True)
    v.on_key(v.cfg.key_talk, True)
    assert state(v) == "listening" and link.sent[-1] == {"type": "wake", "by": "button"}
