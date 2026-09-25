import type { ReactNode } from "react";
import type { ExpressionId } from "roby-face/engine";
import RobyTile from "./RobyTile";

// Stato vuoto con Roby: la mascotte dice cosa fare. SVG statico, nessuna animazione da pagare.
export default function EmptyState({ expression = "happy", title, children }:
  { expression?: ExpressionId; title: string; children?: ReactNode }) {
  return (
    <div className="flex items-start gap-5 py-6">
      <RobyTile expression={expression} className="size-24" />
      <div className="flex flex-col gap-2 pt-2">
        <p className="text-xl font-semibold">{title}</p>
        {children && <div className="text-muted">{children}</div>}
      </div>
    </div>
  );
}
