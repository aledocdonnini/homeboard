#!/usr/bin/env python3
"""Di notte il pannello è spento: un tasto di preselezione lo riaccende per 2 minuti.

La pagina /tv fa lo stesso (mostra i contenuti per 2 minuti, poi torna "fine delle trasmissioni").
Legge gli eventi dei tasti dal dispositivo gpio-keys, senza dipendenze (formato input_event di Linux).
Serve che l'utente sia nel gruppo `input` (lo è di default su Raspberry Pi OS).
"""
import glob
import os
import struct
import subprocess
import threading
from datetime import datetime

WAKE_SECONDS = 120
EVENT = struct.Struct("llHHi")  # timeval (2 long), type, code, value
EV_KEY, KEY_1, KEY_6 = 1, 2, 7
HERE = os.path.dirname(os.path.abspath(__file__))


def env(name, default):
    path = os.path.expanduser("~/.config/homeboard/homeboard.env")
    for line in open(path, encoding="utf-8"):
        if line.lstrip().startswith("#"):
            continue
        key, _, value = line.strip().partition("=")
        if key == name:
            return value.strip('"')
    return default


def is_night():
    start, end = env("NIGHT_START", "23:30"), env("NIGHT_END", "07:00")
    now = datetime.now().strftime("%H:%M")
    return (start <= now < end) if start <= end else (now >= start or now < end)


def screen(state):
    subprocess.run([os.path.join(HERE, "screen.sh"), state], check=False)


def main():
    paths = glob.glob("/dev/input/by-path/*gpio-keys*-event") or glob.glob("/dev/input/by-path/*gpio*-event")
    if not paths:
        raise SystemExit("Nessun dispositivo gpio-keys: controlla dtoverlay=gpio-key in config.txt")
    timer = None
    with open(paths[0], "rb") as device:
        while True:
            _, _, kind, code, value = EVENT.unpack(device.read(EVENT.size))
            if kind != EV_KEY or value != 1 or not KEY_1 <= code <= KEY_6 or not is_night():
                continue
            screen("on")
            if timer:
                timer.cancel()
            timer = threading.Timer(WAKE_SECONDS, lambda: is_night() and screen("off"))
            timer.start()


if __name__ == "__main__":
    main()
