"""I tasti originali del televisore, collegati ai GPIO con l'overlay gpio-key: arrivano come tasti di una
tastiera (/dev/input/eventN). Si leggono con la libreria standard: struct input_event del kernel Linux."""

import queue
import struct
import threading
from typing import Any

# struct input_event (64 bit): timeval (2 × long), type (u16), code (u16), value (s32).
_EVENT = struct.Struct("llHHi")
EV_KEY = 1


class Keys:
    def __init__(self, device: str, events: "queue.Queue[tuple[Any, ...]]") -> None:
        self._device, self._events = device, events

    def start(self) -> None:
        if self._device:
            threading.Thread(target=self._run, daemon=True).start()

    def _run(self) -> None:
        with open(self._device, "rb") as f:
            while data := f.read(_EVENT.size):
                _, _, kind, code, value = _EVENT.unpack(data)
                if kind == EV_KEY and value in (0, 1):  # 1 premuto, 0 rilasciato (2 = ripetizione, ignorata)
                    self._events.put(("key", code, value == 1))
