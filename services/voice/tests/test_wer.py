from roby_voice.wer import normalize, number, wer


def test_numeri() -> None:
    assert [number(w) for w in ["dieci", "ventitré", "ventuno", "trentotto", "latte"]] == [10, 23, 21, 38, None]


def test_normalizza() -> None:
    assert normalize("Timer pasta: dieci minuti!") == ["timer", "pasta", "10", "minuti"]
    assert normalize("metti un timer") == ["metti", "1", "timer"]
    assert normalize("È finito il caffè") == ["e", "finito", "il", "caffe"]


def test_wer() -> None:
    assert wer("timer pasta dieci minuti", "Timer pasta 10 minuti.") == 0.0
    assert wer("aggiungi il latte", "aggiungi latte") == 1 / 3
    assert wer("togli il pane", "togli il cane") == 1 / 3
    assert wer("", "") == 0.0
