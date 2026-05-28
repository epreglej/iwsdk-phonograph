import { createComponent, Types } from "@iwsdk/core";

export const PopIn = createComponent("PopIn", {});
export const PopIn2D = createComponent("PopIn2D", {});
export const PopOut = createComponent("PopOut", {});
export const PopOut2D = createComponent("PopOut2D", {});
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
});
