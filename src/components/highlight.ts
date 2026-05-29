import { createComponent, Types } from "@iwsdk/core";

export const Highlight = createComponent("Highlight", {
  color: { type: Types.Color, default: [0, 0.9, 0.15, 0.275] },
  phase: { type: Types.Float32, default: 0 },
});
