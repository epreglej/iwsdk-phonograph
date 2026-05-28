import { createComponent, Types } from "@iwsdk/core";

export const CrankRotation = createComponent("CrankRotation", {
  lastAngle: { type: Types.Float32, default: 0 },
  totalRotation: { type: Types.Float32, default: 0 },
  lastTickProgress: { type: Types.Float32, default: 0 },
  firstFrame: { type: Types.Boolean, default: true },
});
