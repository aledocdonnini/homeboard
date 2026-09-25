import { createRobotFace, DEFAULTS, EXPRESSIONS, type ExpressionId, type HappyShape, type Mode, type RobotFace } from "./robot-face.js";
import { webSpeechProvider, type VoiceProvider } from "./voice.js";

const IDS = new Set<string>(EXPRESSIONS.map((e) => e.id));
let uid = 0;

// Alone degli occhi come filtro SVG invece del drop-shadow CSS del motore: su iOS WebKit
// il filtro CSS lascia scie mentre gli occhi si muovono (da Roby, components/Face.tsx).
// 6 e 18 px a 400 px = deviazione 0,75 e 2,25 unità del viewBox 100.
const glowFilter = (id: string) => `<defs><filter id="${id}" x="-60%" y="-60%" width="220%" height="220%" color-interpolation-filters="sRGB">
  <feDropShadow dx="0" dy="0" stdDeviation="0.75" flood-color="rgb(120,205,255)" flood-opacity="0.55"/>
  <feDropShadow dx="0" dy="0" stdDeviation="2.25" flood-color="rgb(120,205,255)" flood-opacity="0.3"/>
</filter></defs>`;

const STYLE = `
:host { display: block; aspect-ratio: 1; contain: content; }
:host([hidden]) { display: none; }
.stage { width: 100%; height: 100%; }
svg { filter: none !important; }
`;

export interface SpeakOptions {
  lang?: string;
  /** Espressione da mostrare mentre parla; alla fine torna quella di prima. */
  expression?: ExpressionId;
}

/**
 * <roby-face expression="happy" mode="idle" color="#FAF6EF" background="#131518" motion="2.5" happy-shape="flat" no-glow>
 *
 * Eventi (bubbles, composed): roby-expression {detail: {expression}}, roby-speechstart {detail: {text}}, roby-speechend {detail: {text, error?}}.
 */
export class RobyFaceElement extends HTMLElement {
  static observedAttributes = ["expression", "mode", "color", "background", "motion", "happy-shape", "no-glow"];

  /** Da dove arriva la voce: speechSynthesis se non impostato. */
  voice: VoiceProvider = webSpeechProvider;

  #face?: RobotFace;
  #stage: HTMLDivElement;
  #glowId = `roby-glow-${++uid}`;
  #speech?: AbortController;
  #reduced = matchMedia("(prefers-reduced-motion: reduce)");
  #onReduced = () => this.#applyOptions();

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${STYLE}</style><div class="stage" part="stage"></div>`;
    this.#stage = root.querySelector(".stage")!;
    // Niente attributi qui: un custom element creato con createElement non può averne nel costruttore
    // (il browser lo scarta e l'elemento resta vuoto). Si impostano quando entra nella pagina.
  }

  connectedCallback() {
    if (!this.hasAttribute("role")) this.setAttribute("role", "img");
    if (this.#face) return;
    this.#face = createRobotFace(this.#stage, { radius: 0 });
    const svg = this.#stage.querySelector("svg")!;
    svg.insertAdjacentHTML("afterbegin", glowFilter(this.#glowId));
    this.#applyOptions();
    this.#applyExpression();
    this.#face.setMode(this.mode);
    this.#reduced.addEventListener("change", this.#onReduced);
  }

  disconnectedCallback() {
    this.stop();
    this.#reduced.removeEventListener("change", this.#onReduced);
    this.#face?.destroy();
    this.#face = undefined;
  }

  attributeChangedCallback(name: string, old: string | null, value: string | null) {
    if (!this.#face || old === value) return;
    if (name === "expression") this.#applyExpression();
    else if (name === "mode") this.#face.setMode(this.mode);
    else this.#applyOptions();
  }

  get expression(): ExpressionId {
    const v = this.getAttribute("expression");
    return v && IDS.has(v) ? (v as ExpressionId) : "neutral";
  }
  set expression(id: ExpressionId) {
    this.setAttribute("expression", id);
  }

  get mode(): Mode {
    const v = this.getAttribute("mode");
    return v === "talking" || v === "listening" ? v : "idle";
  }
  set mode(m: Mode) {
    this.setAttribute("mode", m);
  }

  setExpression(id: ExpressionId) {
    this.expression = id;
  }

  blink() {
    this.#face?.blink();
  }

  /** Parla un testo. Un nuovo speak() interrompe il precedente; la Promise si risolve a fine parlato. */
  async speak(text: string, { lang = "it-IT", expression }: SpeakOptions = {}) {
    this.stop();
    const ctrl = (this.#speech = new AbortController());
    const before = this.expression;
    if (expression) this.expression = expression;
    this.mode = "talking";
    this.#emit("roby-speechstart", { text });
    let error: unknown;
    try {
      await this.voice.speak(text, { lang, signal: ctrl.signal, onLevel: (l) => this.#face?.setSpeechLevel(l) });
    } catch (e) {
      error = e;
    } finally {
      if (this.#speech === ctrl) {
        this.#speech = undefined;
        this.#face?.setSpeechLevel(null);
        this.mode = "idle";
        if (expression) this.expression = before;
      }
      this.#emit("roby-speechend", error ? { text, error } : { text });
    }
    if (error) throw error;
  }

  stop() {
    this.#speech?.abort();
  }

  #applyExpression() {
    const id = this.expression;
    this.#face?.setExpression(id);
    this.setAttribute("aria-label", `Roby: ${EXPRESSIONS.find((e) => e.id === id)?.label ?? id}`);
    this.#emit("roby-expression", { expression: id });
  }

  #applyOptions() {
    const motion = Number(this.getAttribute("motion") ?? DEFAULTS.motion);
    this.#face?.setOptions({
      color: this.getAttribute("color") ?? DEFAULTS.color,
      background: this.getAttribute("background") ?? DEFAULTS.background,
      happyShape: (this.getAttribute("happy-shape") as HappyShape | null) ?? DEFAULTS.happyShape,
      motion: this.#reduced.matches ? 0 : Number.isFinite(motion) ? motion : DEFAULTS.motion,
    });
    // no-glow: occhi pieni senza alone, per sfondi chiari (e schermi lenti).
    this.#stage.querySelectorAll("path").forEach((p) =>
      this.hasAttribute("no-glow") ? p.removeAttribute("filter") : p.setAttribute("filter", `url(#${this.#glowId})`));
  }

  #emit(type: string, detail: object) {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }
}
