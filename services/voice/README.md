# voice

Servizio Python sul Raspberry (fase 5). Fa solo audio e tutto resta in locale: da qui esce soltanto testo.

1. **Ascolto.** openWakeWord aspetta "Ehi Roby". In alternativa c'è il tasto *premi e parla*.
2. **Fine frase.** Il VAD (Silero) capisce quando hai finito di parlare.
3. **Trascrizione.** La fa `SttEngine`, con Vosk oppure faster-whisper (`roby_voice/stt.py`).
4. **Invio.** Il testo va a `brain` sul socket Unix (`roby_voice/protocol.py`).
5. **Risposta.** Piper dice la risposta, e intanto passa a `brain` il volume per muovere la bocca di Roby.
6. **Barge-in.** Se parli mentre Roby risponde, Roby si interrompe.
7. **Silenzio.** Il tasto di silenziamento spegne il microfono. Lo stato si vede sempre su `/casa`.
