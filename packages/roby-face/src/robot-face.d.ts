// Tipi per robot-face.js, il motore copiato da Roby (lib/robot-face.js) senza modifiche.

export type ExpressionId =
  | "neutral" | "happy" | "laugh" | "excited" | "sad" | "worried" | "angry" | "determined"
  | "shocked" | "surprised" | "in-love" | "ko" | "amused" | "serene" | "sleepy" | "bored"
  | "skeptical" | "wink" | "sly" | "nervous" | "thinking" | "shy" | "listening" | "confused";

export type Mode = "idle" | "talking" | "listening";
export type HappyShape = "flat" | "arc" | "sharp-arc";

export interface FaceOptions {
  color: string;
  background: string;
  eyeGlow: string;
  happyShape: HappyShape;
  motion: number;
  morphMs: number;
  radius: number;
  autoCycle: number;
}

export interface RobotFace {
  setExpression(id: ExpressionId): void;
  getExpression(): ExpressionId;
  setMode(mode: Mode): void;
  setSpeechLevel(level: number | null): void;
  blink(): void;
  setOptions(next: Partial<FaceOptions>): void;
  destroy(): void;
}

export const EXPRESSIONS: readonly { id: ExpressionId; label: string; pose: unknown }[];
export const DEFAULTS: FaceOptions;
export function staticSVG(id: ExpressionId, opts?: Partial<FaceOptions> & { transparent?: boolean }): string;
export function createRobotFace(container: HTMLElement, opts?: Partial<FaceOptions>): RobotFace;
