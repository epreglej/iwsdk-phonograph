import { createComponent, Types } from "@iwsdk/core";

export const Highlight = createComponent("Highlight", {
  color: { type: Types.Color, default: [0, 0.9, 0.15, 0.275] },
  phase: { type: Types.Float32, default: 0 },
});

export const STOP_HIGHLIGHT_COLOR: [number, number, number, number] = [
  1, 0.12, 0.08, 0.38,
];

export const RECORDING_INPUT_HIGHLIGHT_COLOR: [number, number, number, number] =
  [1, 0.45, 0.08, 0.42];
