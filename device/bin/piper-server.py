#!/usr/bin/env python3
"""La voce di Roby sul Raspberry: GET /?text=... restituisce un WAV letto da Piper, in italiano.

La pagina /casa lo usa con ?voce=http://127.0.0.1:5002/?text= (roby-face, audioUrlProvider):
così il volto muove gli occhi seguendo l'audio vero. Ascolta solo su 127.0.0.1.
Le frasi già dette restano in memoria (le stesse tornano spesso: "La lista della spesa è vuota.").
"""
import io
import os
import wave
from functools import lru_cache
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from piper import PiperVoice  # pip install piper-tts (nel venv creato da install.sh)

VOICE = os.environ.get("PIPER_VOICE", "it_IT-paola-medium")
MODELS = os.path.expanduser(os.environ.get("PIPER_MODELS", "~/.local/share/piper"))
PORT = int(os.environ.get("PIPER_PORT", "5002"))
MAX_CHARS = 600

voice = PiperVoice.load(os.path.join(MODELS, f"{VOICE}.onnx"))


@lru_cache(maxsize=64)
def speak(text: str) -> bytes:
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav:
        voice.synthesize_wav(text, wav)
    return buffer.getvalue()


class Handler(BaseHTTPRequestHandler):
    def headers_for_page(self):
        # La pagina arriva da internet (https) e chiama la rete locale: servono CORS e Private Network Access.
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Access-Control-Allow-Local-Network", "true")

    def do_OPTIONS(self):
        self.send_response(204)
        self.headers_for_page()
        self.send_header("Access-Control-Allow-Methods", "GET")
        self.end_headers()

    def do_GET(self):
        text = parse_qs(urlparse(self.path).query).get("text", [""])[0].strip()[:MAX_CHARS]
        if not text:
            self.send_response(400)
            self.headers_for_page()
            self.end_headers()
            return
        audio = speak(text)
        self.send_response(200)
        self.headers_for_page()
        self.send_header("Content-Type", "audio/wav")
        self.send_header("Content-Length", str(len(audio)))
        self.end_headers()
        self.wfile.write(audio)

    def log_message(self, fmt, *args):  # niente log per ogni frase
        pass


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
