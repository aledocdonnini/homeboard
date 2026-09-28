"""Quale microfono sente? python -m roby_voice.mics

Registra un secondo e mezzo da ogni ingresso (parla o schiocca le dita) e stampa il picco. Picco 0 vuol dire
silenzio "finto": su macOS manca il permesso del microfono, o il MacBook è chiuso e il microfono interno è spento.
Il nome che sente va in ROBY_INPUT_DEVICE.
"""


def main() -> None:
    import numpy as np
    import sounddevice as sd

    for i, d in enumerate(sd.query_devices()):
        if d["max_input_channels"] < 1:
            continue
        try:
            x = sd.rec(int(16000 * 1.5), samplerate=16000, channels=1, dtype="int16", device=i)
            sd.wait()
            print(f"{i:>2}  {d['name']:<34} picco {int(np.abs(x.astype(np.int32)).max())}", flush=True)
        except Exception as e:  # un ingresso che non si apre non deve fermare gli altri
            print(f"{i:>2}  {d['name']:<34} non si apre: {e}", flush=True)


if __name__ == "__main__":
    main()
