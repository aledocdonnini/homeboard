import { staticSVG, type ExpressionId } from "roby-face/engine";

// Roby fermo, come icona di una schermata. Decorativo: il testo accanto dice già tutto.
export default function RobyTile({ expression = "neutral", className = "size-20" }: { expression?: ExpressionId; className?: string }) {
  return <div aria-hidden className={`shrink-0 ${className}`} dangerouslySetInnerHTML={{ __html: staticSVG(expression, { radius: 0.22 }) }} />;
}
