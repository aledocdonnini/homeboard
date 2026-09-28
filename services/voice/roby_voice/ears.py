"""Le orecchie: parola di attivazione (openWakeWord) e voce sì/no (Silero VAD, incluso in openWakeWord).
Entrambi lavorano su blocchi da 80 ms a 16 kHz."""

from typing import Any

from .config import Config

RATE = 16_000
FRAME = 1280  # 80 ms: il passo di openWakeWord


class Ears:
    def __init__(self, cfg: Config) -> None:
        from openwakeword.model import Model
        from openwakeword.vad import VAD
        base = cfg.models / "openwakeword"
        name = cfg.wake_model if cfg.wake_model.endswith(".onnx") else next(
            str(p) for p in sorted(base.glob(f"{cfg.wake_model}*.onnx")))
        self._wake = Model(wakeword_models=[name], inference_framework="onnx",
                           melspec_model_path=str(base / "melspectrogram.onnx"), embedding_model_path=str(base / "embedding_model.onnx"))
        self._vad = VAD(model_path=str(base / "silero_vad.onnx"))
        self.last_scores: dict[str, float] = {}

    def wake(self, frame: Any) -> float:
        """Probabilità che in questo blocco (e nei precedenti) ci sia la parola di attivazione."""
        scores = self._wake.predict(frame)
        self.last_scores = {k: float(v) for k, v in scores.items()}
        return max(self.last_scores.values(), default=0.0)

    def speech(self, frame: Any) -> float:
        """Probabilità che in questo blocco qualcuno parli."""
        return float(self._vad.predict(frame, frame_size=640))

    def reset(self) -> None:
        """Dopo un'attivazione: si riparte da zero, altrimenti la stessa parola scatta due volte."""
        self._wake.reset()
