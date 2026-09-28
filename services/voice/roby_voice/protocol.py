"""Messaggi fra voice e brain: JSON, una riga per messaggio, sul socket Unix.

Gemello di packages/core/src/protocol.ts (VoiceToBrain, BrainToVoice): vanno cambiati insieme.
voice manda a brain solo testo e numeri, mai audio.
"""

from typing import Literal, TypedDict


# ——— voice → brain ———

class Wake(TypedDict):
    type: Literal["wake"]
    by: Literal["word", "button"]


class Heard(TypedDict):
    type: Literal["heard"]
    text: str
    engine: str
    ms: int


class Nothing(TypedDict):
    type: Literal["nothing"]


class Speaking(TypedDict):
    type: Literal["speaking"]
    id: str


class Level(TypedDict):
    type: Literal["level"]
    value: float


class Spoken(TypedDict):
    type: Literal["spoken"]
    id: str
    interrupted: bool


class Mic(TypedDict):
    type: Literal["mic"]
    muted: bool


VoiceToBrain = Wake | Heard | Nothing | Speaking | Level | Spoken | Mic


# ——— brain → voice ———

class _SayBase(TypedDict):
    type: Literal["say"]
    id: str
    text: str


class Say(_SayBase, total=False):
    listen: bool


class Stop(TypedDict):
    type: Literal["stop"]


class Alarm(TypedDict):
    type: Literal["alarm"]
    on: bool


BrainToVoice = Say | Stop | Alarm
