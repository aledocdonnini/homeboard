# roby-face

Il volto animato di Roby come web component: solo occhi, 24 espressioni con morph tra le forme, e voce del browser o di qualunque endpoint audio. Nessuna dipendenza e nessun framework.

```html
<script type="module">import "roby-face";</script>
<roby-face expression="happy" style="width: 320px"></roby-face>
```

```js
const roby = document.querySelector("roby-face");
roby.expression = "worried";
await roby.speak("Domani scade il bollo dell'auto.", { expression: "worried" });
```

## Attributi

| Attributo | Valori | Predefinito |
|---|---|---|
| `expression` | una delle 24 espressioni in `EXPRESSIONS` (`neutral`, `happy`, `worried`, `sleepy`, `surprised`, …) | `neutral` |
| `mode` | `idle`, `talking`, `listening` | `idle` |
| `color`, `background` | colori CSS (`color` accetta anche `currentColor`) | `#FAF6EF`, `#131518` |
| `motion` | intensità del movimento, 0 = fermo | `2.5` (0 con `prefers-reduced-motion`) |
| `happy-shape` | `flat`, `arc`, `sharp-arc` | `flat` |
| `no-glow` | presente o assente: toglie l'alone azzurro (per sfondi chiari) | assente |

L'elemento è quadrato (`aspect-ratio: 1`): basta dargli la larghezza. Lo sfondo interno si raggiunge con `::part(stage)`.

## Metodi

- `speak(text, { lang = "it-IT", expression? })`: parla e restituisce una Promise che si risolve a fine parlato. Un nuovo `speak()` interrompe il precedente; `expression` vale solo mentre parla.
- `stop()`: interrompe la voce.
- `setExpression(id)`, `blink()`.

## Eventi

Tutti con `bubbles` e `composed`:

- `roby-expression`, con `detail`: `{ expression }`
- `roby-speechstart`, con `detail`: `{ text }`
- `roby-speechend`, con `detail`: `{ text, error? }`

## Voce

La proprietà `voice` accetta un `VoiceProvider`:

- **`webSpeechProvider`** (predefinito): usa `speechSynthesis`, è gratuito, e la bocca segue sillabe procedurali.
- **`audioUrlProvider(url, gain?)`**: fa GET su un URL che restituisce audio (per esempio Piper in locale). In questo caso il movimento degli occhi segue l'ampiezza reale dell'audio.

```js
import { audioUrlProvider } from "roby-face";
roby.voice = audioUrlProvider((text) => `http://localhost:5002/?text=${encodeURIComponent(text)}`);
```

Per una voce propria basta un oggetto con `speak(text, { lang, signal, onLevel })`. `onLevel` riceve un numero da 0 a 1, oppure `null` per le sillabe procedurali. La voce deve fermarsi quando `signal` viene interrotto.

## SSR e motore

`import "roby-face"` registra l'elemento e funziona solo nel browser. Nei framework con rendering lato server va quindi importato dinamicamente lato client.

`roby-face/engine` espone il motore senza DOM al caricamento: `EXPRESSIONS`, `DEFAULTS`, `staticSVG(id)` per icone e anteprime, e `createRobotFace(container)`. Si può importare anche lato server.
