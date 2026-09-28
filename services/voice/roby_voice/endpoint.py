"""Fine frase: dopo la parola di attivazione, quando ho smesso di parlare?

Logica pura: riceve i blocchi audio e, per ognuno, la probabilità di voce del VAD (Silero). Testata in
tests/test_endpoint.py.
- Se nessuno parla entro `start_timeout_ms`, non c'era una richiesta ("nothing").
- Dopo aver sentito la voce, `silence_ms` di silenzio chiudono la frase ("done").
- Una frase non dura più di `max_ms`: sul Pi la trascrizione di un monologo costerebbe troppo.
"""

from dataclasses import dataclass, field
from typing import Literal

Verdict = Literal["more", "done", "nothing"]


@dataclass
class Endpoint:
    frame_ms: int = 80
    threshold: float = 0.5
    start_timeout_ms: int = 5000
    silence_ms: int = 700
    max_ms: int = 10_000
    frames: list[bytes] = field(default_factory=list)
    heard: bool = False
    silence: int = 0
    elapsed: int = 0

    def push(self, frame: bytes, speech: float) -> Verdict:
        self.frames.append(frame)
        self.elapsed += self.frame_ms
        if speech >= self.threshold:
            self.heard, self.silence = True, 0
        elif self.heard:
            self.silence += self.frame_ms
        if self.heard and self.silence >= self.silence_ms:
            return "done"
        if not self.heard and self.elapsed >= self.start_timeout_ms:
            return "nothing"
        if self.elapsed >= self.max_ms:
            return "done" if self.heard else "nothing"
        return "more"

    def audio(self) -> bytes:
        """La frase, senza il silenzio finale (meno audio da trascrivere)."""
        keep = len(self.frames) - self.silence // self.frame_ms
        return b"".join(self.frames[: max(keep + 2, 0)])
