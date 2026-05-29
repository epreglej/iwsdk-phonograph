import { createComponent, Types } from "@iwsdk/core";

/** Scale pop animations. `from` < 0 is a sentinel meaning "capture on first frame". */
const POP_FIELDS = {
  elapsed: { type: Types.Float32, default: 0 },
  from: { type: Types.Float32, default: -1 },
} as const;

export const PopIn = createComponent("PopIn", { ...POP_FIELDS });
export const PopIn2D = createComponent("PopIn2D", { ...POP_FIELDS });
export const PopOut = createComponent("PopOut", { ...POP_FIELDS });
export const PopOut2D = createComponent("PopOut2D", { ...POP_FIELDS });

export const Spin = createComponent("Spin", {});

export const SnapAnimation = createComponent("SnapAnimation", {
  targetX: { type: Types.Float32, default: 0 },
  targetY: { type: Types.Float32, default: 0 },
  targetZ: { type: Types.Float32, default: 0 },
  targetQX: { type: Types.Float32, default: 0 },
  targetQY: { type: Types.Float32, default: 0 },
  targetQZ: { type: Types.Float32, default: 0 },
  targetQW: { type: Types.Float32, default: 1 },
  duration: { type: Types.Float32, default: 300 },
  elapsed: { type: Types.Float32, default: 0 },
  started: { type: Types.Boolean, default: false },
  fromX: { type: Types.Float32, default: 0 },
  fromY: { type: Types.Float32, default: 0 },
  fromZ: { type: Types.Float32, default: 0 },
  fromQX: { type: Types.Float32, default: 0 },
  fromQY: { type: Types.Float32, default: 0 },
  fromQZ: { type: Types.Float32, default: 0 },
  fromQW: { type: Types.Float32, default: 1 },
});
