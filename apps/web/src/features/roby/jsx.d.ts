// <roby-face> in JSX. React 19 passa gli attributi al custom element così come sono.
import type { DetailedHTMLProps, HTMLAttributes } from "react";
import type { ExpressionId, HappyShape, Mode, RobyFaceElement } from "roby-face";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "roby-face": DetailedHTMLProps<HTMLAttributes<RobyFaceElement>, RobyFaceElement> & {
        expression?: ExpressionId;
        mode?: Mode;
        color?: string;
        background?: string;
        motion?: number;
        "happy-shape"?: HappyShape;
        "no-glow"?: "";
      };
    }
  }
}
