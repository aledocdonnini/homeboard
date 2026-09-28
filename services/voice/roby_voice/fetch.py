"""Scarica i modelli (una volta sola, poi tutto funziona senza rete): python -m roby_voice.fetch [--whisper]

In ROBY_MODELS: la parola di attivazione (openWakeWord), le voci italiane (Piper, e Kokoro se è il motore
scelto), il modello italiano di Vosk e, se richiesto, faster-whisper.
"""

import sys
import urllib.request
import zipfile
from pathlib import Path

from .config import Config

PIPER = "https://huggingface.co/rhasspy/piper-voices/resolve/main/it/it_IT/{name}/{quality}/{voice}.onnx"
VOSK = "https://alphacephei.com/vosk/models/{model}.zip"
KOKORO = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/{file}"


def _get(url: str, dest: Path) -> None:
    if dest.exists():
        return
    print(f"↓ {url}")
    tmp = dest.with_suffix(dest.suffix + ".part")
    urllib.request.urlretrieve(url, tmp)
    tmp.rename(dest)


def main() -> None:
    cfg = Config()
    cfg.models.mkdir(parents=True, exist_ok=True)

    from openwakeword.utils import download_models
    wake = cfg.models / "openwakeword"
    wake.mkdir(exist_ok=True)
    download_models([] if cfg.wake_model == "ehi_roby" else [cfg.wake_model], target_directory=str(wake))

    _, name, quality = cfg.piper_voice.split("-")
    for ext in (".onnx", ".onnx.json"):
        _get(PIPER.format(name=name, quality=quality, voice=cfg.piper_voice) + ext.removeprefix(".onnx"), cfg.models / f"{cfg.piper_voice}{ext}")

    if cfg.tts == "kokoro" or cfg.tts_fallback == "kokoro":
        (cfg.models / "kokoro").mkdir(exist_ok=True)
        for file in (cfg.kokoro_model, "voices-v1.0.bin"):
            _get(KOKORO.format(file=file), cfg.models / "kokoro" / file)

    vosk = cfg.models / cfg.vosk_model
    if not vosk.exists():
        archive = cfg.models / f"{cfg.vosk_model}.zip"
        _get(VOSK.format(model=cfg.vosk_model), archive)
        with zipfile.ZipFile(archive) as z:
            z.extractall(cfg.models)
        archive.unlink()

    if "--whisper" in sys.argv or cfg.stt == "whisper":
        from faster_whisper import download_model
        download_model(cfg.whisper_model, output_dir=str(cfg.models / f"whisper-{cfg.whisper_model}"))
    print(f"Modelli in {cfg.models}")


if __name__ == "__main__":
    main()
