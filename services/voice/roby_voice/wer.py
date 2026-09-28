"""Precisione della trascrizione: WER (word error rate) fra la frase detta e quella trascritta.

Prima si normalizza: minuscole, niente accenti ("è" ed "e" suonano uguali), niente punteggiatura, numeri in
cifre ("dieci" e "10", "un" e "1" sono la stessa cosa: Vosk scrive in lettere, Whisper in cifre, e all'interprete
vanno bene entrambi).
"""

import re
import unicodedata

_UNITS = ["zero", "uno", "due", "tre", "quattro", "cinque", "sei", "sette", "otto", "nove", "dieci", "undici", "dodici",
          "tredici", "quattordici", "quindici", "sedici", "diciassette", "diciotto", "diciannove"]
_TENS = {"venti": 20, "trenta": 30, "quaranta": 40, "cinquanta": 50, "sessanta": 60, "settanta": 70, "ottanta": 80, "novanta": 90}


def _fold(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def number(word: str) -> int | None:
    """ "ventitré" → 23, "ventuno" → 21, "dieci" → 10; altrimenti None (come toNumber di packages/intents)."""
    w = _fold(word)
    if w in ("un", "una", "uno"):
        return 1
    if w in _UNITS:
        return _UNITS.index(w)
    for tens, value in _TENS.items():
        if w == tens:
            return value
        rest = w[len(tens):]
        if w.startswith(tens) and rest in _UNITS[2:10]:
            return value + _UNITS.index(rest)
        stem = tens[:-1]
        if w.startswith(stem) and w[len(stem):] in ("uno", "otto"):
            return value + (1 if w.endswith("uno") else 8)
    return None


def normalize(text: str) -> list[str]:
    words = re.findall(r"[\w']+", _fold(text.lower().replace("’", "'")))
    return [str(n) if (n := number(w)) is not None else w for w in words]


def wer(reference: str, hypothesis: str) -> float:
    ref, hyp = normalize(reference), normalize(hypothesis)
    if not ref:
        return 0.0 if not hyp else 1.0
    row = list(range(len(hyp) + 1))
    for i, r in enumerate(ref, 1):
        prev, row[0] = row[0], i
        for j, h in enumerate(hyp, 1):
            prev, row[j] = row[j], min(row[j] + 1, row[j - 1] + 1, prev + (r != h))
    return row[-1] / len(ref)
