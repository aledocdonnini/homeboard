from roby_voice.endpoint import Endpoint

F = b"\x00\x00" * 1280  # 80 ms a 16 kHz


def run(probs: list[float], max_ms: int = 10_000) -> tuple[str, Endpoint]:
    e = Endpoint(max_ms=max_ms)
    verdict = "more"
    for p in probs:
        verdict = e.push(F, p)
        if verdict != "more":
            break
    return verdict, e


def test_frase_chiusa_dal_silenzio() -> None:
    verdict, e = run([0.0] * 3 + [0.9] * 10 + [0.1] * 20)
    assert verdict == "done"
    assert e.elapsed == (3 + 10 + 9) * 80, "700 ms di silenzio: 9 blocchi da 80"


def test_nessuno_parla() -> None:
    verdict, _ = run([0.1] * 100)
    assert verdict == "nothing"


def test_una_pausa_breve_non_chiude() -> None:
    verdict, e = run([0.9] * 5 + [0.1] * 5 + [0.9] * 5 + [0.1] * 9)
    assert verdict == "done"
    assert e.elapsed == 24 * 80


def test_troppo_lunga() -> None:
    verdict, _ = run([0.9] * 200, max_ms=2000)
    assert verdict == "done"


def test_audio_senza_silenzio_finale() -> None:
    _, e = run([0.9] * 10 + [0.1] * 9)
    assert len(e.audio()) == (10 + 2) * len(F)


def test_frasi_per_la_sintesi() -> None:
    from roby_voice.tts import sentences
    assert sentences("Aggiunti: latte e uova. Da prendere: pane!") == ["Aggiunti:", "latte e uova.", "Da prendere:", "pane!"]
    assert sentences("Costa 10,5 euro.") == ["Costa 10,5 euro."]
