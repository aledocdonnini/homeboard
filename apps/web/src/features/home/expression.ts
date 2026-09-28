import type { ExpressionId } from "roby-face";

export type TvMood = {
  night: boolean;
  /** Un elemento è appena arrivato (la TV lo tiene vero per ~3 secondi). */
  justAdded: boolean;
  /** Giorni mancanti alle scadenze da fare: 0 = oggi, negativo = superata. */
  daysLeft: number[];
  shoppingCount: number;
};

export const WORRY_DAYS = 3;

// Espressione di Roby sulla TV, in ordine di priorità.
export function expressionFor({ night, justAdded, daysLeft, shoppingCount }: TvMood): ExpressionId {
  if (night) return "sleepy";
  if (justAdded) return "surprised";
  if (daysLeft.some((d) => d < 0)) return "nervous";
  if (daysLeft.some((d) => d <= WORRY_DAYS)) return "worried";
  if (shoppingCount === 0) return "happy";
  return "neutral";
}
