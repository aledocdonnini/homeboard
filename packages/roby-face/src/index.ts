// Solo browser: importarlo registra <roby-face>. In SSR va importato dinamicamente lato client.
import { RobyFaceElement } from "./roby-face.js";

export { RobyFaceElement, type SpeakOptions } from "./roby-face.js";
export { webSpeechProvider, audioUrlProvider, type VoiceProvider } from "./voice.js";
export { EXPRESSIONS, DEFAULTS, staticSVG, createRobotFace } from "./robot-face.js";
export type { ExpressionId, Mode, HappyShape, FaceOptions, RobotFace } from "./robot-face.js";

if (!customElements.get("roby-face")) customElements.define("roby-face", RobyFaceElement);

declare global {
  interface HTMLElementTagNameMap {
    "roby-face": RobyFaceElement;
  }
}
