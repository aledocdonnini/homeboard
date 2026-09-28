"""Il filo con brain: socket Unix (o tcp://host:porta, per Docker sul Mac), un messaggio JSON per riga.
Se brain non c'è si riprova ogni 2 secondi; i messaggi in arrivo finiscono nella coda degli eventi."""

import json
import queue
import socket
import threading
import time
from typing import Any

from .protocol import VoiceToBrain


class Link:
    def __init__(self, address: str, events: "queue.Queue[tuple[Any, ...]]") -> None:
        self._address, self._events = address, events
        self._sock: socket.socket | None = None
        self._lock = threading.Lock()

    def start(self) -> None:
        threading.Thread(target=self._run, daemon=True).start()

    def send(self, msg: VoiceToBrain) -> None:
        with self._lock:
            if self._sock is None:
                return  # senza brain non c'è nessuno a cui dirlo
            try:
                self._sock.sendall((json.dumps(msg, ensure_ascii=False) + "\n").encode())
            except OSError:
                self._sock = None

    def _connect(self) -> socket.socket:
        if self._address.startswith("tcp://"):
            host, port = self._address.removeprefix("tcp://").rsplit(":", 1)
            return socket.create_connection((host, int(port)))
        s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        s.connect(self._address)
        return s

    def _run(self) -> None:
        while True:
            try:
                sock = self._connect()
            except OSError:
                time.sleep(2)
                continue
            with self._lock:
                self._sock = sock
            self._events.put(("link", True))
            try:
                for line in sock.makefile(encoding="utf-8"):
                    if line.strip():
                        self._events.put(("brain", json.loads(line)))
            except (OSError, ValueError):
                pass
            with self._lock:
                self._sock = None
            self._events.put(("link", False))
            time.sleep(2)
